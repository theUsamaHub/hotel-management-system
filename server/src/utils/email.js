import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import EmailJob from '../models/EmailJob.js';

// Queue bodies contain recovery links, so encrypt them at rest with a domain-separated key.
const key = createHash('sha256').update(`email-outbox:${env.MAIL_ENCRYPTION_KEY || env.JWT_REFRESH_SECRET}`).digest();
const keyId = createHash('sha256').update(key).digest('hex');
export function decodeEmail(payload) {
  try {
    const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString());
  } catch {
    throw Object.assign(new Error('Queued email cannot be decrypted'), { code: 'EMAIL_DECRYPTION_FAILED' });
  }
}
export async function queueEmail(to, subject, text, expiresAt = new Date(Date.now() + 86400000), session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ to, subject, text })), cipher.final()]);
  const payload = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  await EmailJob.create([{ payload, keyId, expiresAt }], { session });
}
let transporter;
export const emailDelivery = {
  async send(message, id) {
    if (env.MAIL_MODE === 'file') {
      const directory = fileURLToPath(new URL('../../mail-outbox/', import.meta.url));
      await mkdir(directory, { recursive: true });
      await writeFile(`${directory}/${randomUUID()}.json`, JSON.stringify(message, null, 2), { mode: 0o600, flag: 'wx' });
      console.info(`Email preview saved in ${directory}. File mode does not send to an inbox.`);
      return;
    }
    if (env.MAIL_MODE === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `account-email/${id}` },
        body: JSON.stringify({ from: env.MAIL_FROM, ...message }),
      });
      if (!response.ok) throw Object.assign(new Error('Email provider rejected the request'), { code: 'EMAIL_HTTP_FAILED' });
      return;
    }
    transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      requireTLS: true, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
      disableFileAccess: true, disableUrlAccess: true,
    });
    await transporter.sendMail({ from: env.MAIL_FROM, ...message });
  },
};

export function emailFailure(error) {
  const reasons = {
    EMAIL_DECRYPTION_FAILED: 'Queued message was encrypted with a different key or is damaged. Request a fresh link. Keep MAIL_ENCRYPTION_KEY stable.',
    EAUTH: 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS (your provider may require an app password).',
    ECONNECTION: 'Cannot connect to SMTP. Check SMTP_HOST, SMTP_PORT, and outbound network access.',
    ECONNREFUSED: 'SMTP connection refused. Check the host, port, and firewall.',
    ETIMEDOUT: 'SMTP connection timed out. Check outbound network access and provider settings.',
    EDNS: 'SMTP hostname could not be resolved. Check SMTP_HOST.',
    ESOCKET: 'SMTP socket/TLS connection failed. Check port and certificate configuration.',
    ETLS: 'SMTP TLS negotiation failed. Check provider TLS/STARTTLS requirements.',
    EENVELOPE: 'SMTP rejected the sender or recipient. Check MAIL_FROM and provider sender verification.',
    EMESSAGE: 'SMTP rejected the message. Check provider restrictions.',
    EMAIL_HTTP_FAILED: 'HTTPS email provider rejected the request. Check API key, sender verification, and provider limits.',
    EACCES: 'Cannot write the local email preview. Check directory permissions.',
    EPERM: 'Cannot write the local email preview. Check directory permissions.',
    ENOSPC: 'No disk space for the local email preview.',
  };
  // Only log fixed descriptions. Provider exceptions can contain addresses or credentials.
  const code = Object.hasOwn(reasons, error?.code) ? error.code : 'EMAIL_DELIVERY_FAILED';
  return { code, reason: reasons[code] || 'Delivery failed. Check the active mail mode and provider settings.' };
}

export async function deliverNextEmail() {
  const now = new Date();
  const job = await EmailJob.findOneAndUpdate({ availableAt: { $lte: now }, leaseUntil: { $lte: now },
    expiresAt: { $gt: now }, attempts: { $lt: 5 }, failedAt: { $exists: false },
    $or: [{ keyId }, { keyId: { $exists: false } }] },
  { $set: { leaseUntil: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } },
  { returnDocument: 'after', sort: { createdAt: 1 } }).select('+payload');
  if (!job) return false;
  try {
    await emailDelivery.send(decodeEmail(job.payload), job.id);
    await job.deleteOne();
  } catch (error) {
    // Never log message bodies, recipient addresses, SMTP passwords, or recovery tokens.
    const failure = emailFailure(error);
    const stopped = failure.code === 'EMAIL_DECRYPTION_FAILED' || job.attempts >= 5;
    console.error(`Email delivery [${failure.code}] mode=${env.MAIL_MODE}, attempt=${job.attempts}/5. ${failure.reason} ${stopped ? 'Retries stopped; request a fresh email after fixing configuration.' : 'Queued retry will follow.'}`);
    await EmailJob.updateOne({ _id: job._id }, { $set: {
      lastErrorCode: failure.code, ...(stopped ? { failedAt: new Date() } : {}),
      availableAt: new Date(Date.now() + 30000 * 2 ** job.attempts), leaseUntil: new Date(0),
    } });
  }
  return true;
}
export function startEmailWorker() {
  console.info(env.MAIL_MODE === 'file'
    ? `Email mode=file. Local previews: ${fileURLToPath(new URL('../../mail-outbox/', import.meta.url))}. Set MAIL_MODE=smtp for real inbox delivery.`
    : `Email mode=${env.MAIL_MODE}. Real inbox delivery is enabled; queued messages are processed in the background.`);
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await deliverNextEmail(); } catch { console.error('Email queue unavailable; retrying later.'); }
    finally { busy = false; }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
