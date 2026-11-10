import { audit } from '../utils/audit.js';
import escapeRegex from '../utils/escapeRegex.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditEvent from '../models/AuditEvent.js';
import { env } from '../config/env.js';
import { hashToken, clearCookies } from '../utils/generateToken.js';
import { queueEmail } from '../utils/email.js';
import ApiError from '../utils/ApiError.js';
import { inspectMedia } from '../middleware/upload.js';
import { storageFor, uploadProvider } from '../storage/index.js';

const generic = 'If the account is eligible, an email will arrive shortly. Check your inbox and spam folder.';
const cutoff = () => new Date(Date.now() - 60000);
const link = (path, token) => `${env.CLIENT_URL}/${path}#token=${token}`;

export async function requestVerification(user, pendingEmail) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 86400000);
  const updated = await User.findOneAndUpdate({ _id: user._id, isActive: true, ...(pendingEmail ? { password: user.password } : {}),
    $or: [{ verificationSentAt: { $exists: false } }, { verificationSentAt: { $lte: cutoff() } }] },
  { $set: { verificationHash: hashToken(token), verificationExpires: expires, verificationSentAt: new Date(),
    ...(pendingEmail ? { pendingEmail } : {}) } }, { returnDocument: 'after' }).select('+pendingEmail');
  if (!updated) return false;
  try {
    await queueEmail(updated.pendingEmail || updated.email, 'Verify your email address',
      `Confirm your email address using this link (valid for 24 hours):\n${link('verify-email', token)}\nIf you did not request this, ignore this email.`, expires);
  } catch (error) {
    await User.updateOne({ _id: user._id, verificationHash: hashToken(token) },
      { $unset: { verificationHash: 1, verificationExpires: 1, verificationSentAt: 1 } });
    throw error;
  }
  return true;
}

export async function forgotPassword(req, res) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 60000);
  const user = await User.findOneAndUpdate({ email: req.body.email, isActive: true,
    $or: [{ resetSentAt: { $exists: false } }, { resetSentAt: { $lte: cutoff() } }] },
  { $set: { resetHash: hashToken(token), resetExpires: expires, resetSentAt: new Date() } });
  if (user) {
    try {
      await queueEmail(user.email, 'Reset your password',
        `Reset your password using this link (valid for 30 minutes):\n${link('reset-password', token)}\nIf you did not request this, ignore this email.`, expires);
    } catch {
      await User.updateOne({ _id: user._id, resetHash: hashToken(token) },
        { $unset: { resetHash: 1, resetExpires: 1, resetSentAt: 1 } });
      console.error('Password recovery email could not be queued.');
    }
  }
  res.json({ success: true, message: generic });
}

export async function resetPassword(req, res) {
  const password = await bcrypt.hash(req.body.password, 12);
  // Consume the token and advance the security version atomically, including concurrent requests.
  const user = await User.findOneAndUpdate({ resetHash: hashToken(req.body.token), resetExpires: { $gt: new Date() }, isActive: true },
    { $set: { password }, $inc: { authVersion: 1 }, $unset: { resetHash: 1, resetExpires: 1, refreshTokenHash: 1,
      pendingEmail: 1, verificationHash: 1, verificationExpires: 1, verificationSentAt: 1 } });
  if (!user) throw new ApiError(400, 'Invalid or expired link. Request a new one.');
  await Session.deleteMany({ user: user._id });
  clearCookies(res);
  await audit({ ...req, user }, 'account.password_change', user._id);
  await queueEmail(user.email, 'Your password was changed', 'Your password was reset. All sessions have been signed out. If this was not you, reset your password immediately.');
  res.json({ success: true, message: 'Password reset. Sign in with your new password.' });
}

export async function resendVerification(req, res) {
  const user = await User.findById(req.user._id).select('+pendingEmail');
  if (!user.emailVerified || user.pendingEmail) await requestVerification(user);
  res.json({ success: true, message: generic });
}

export async function verifyEmail(req, res) {
  const filter = { verificationHash: hashToken(req.body.token), verificationExpires: { $gt: new Date() }, isActive: true };
  const candidate = await User.findOne(filter).select('+pendingEmail');
  if (!candidate) throw new ApiError(400, 'Invalid or expired link. Request a new one.');
  const changing = !!candidate.pendingEmail;
  const user = await User.findOneAndUpdate({ ...filter, _id: candidate._id }, {
    $set: { emailVerified: true, ...(changing ? { email: candidate.pendingEmail } : {}) },
    $unset: { verificationHash: 1, verificationExpires: 1, pendingEmail: 1,
      ...(changing ? { resetHash: 1, resetExpires: 1, refreshTokenHash: 1 } : {}) },
    ...(changing ? { $inc: { authVersion: 1 } } : {}),
  });
  if (!user) throw new ApiError(400, 'Invalid or expired link. Request a new one.');
  if (changing) {
    await Session.deleteMany({ user: user._id });
    clearCookies(res);
    await queueEmail(candidate.email, 'Your email address changed', 'Your account email address was changed. If this was not you, contact your workspace administrator immediately.');
  } else {
    await queueEmail(user.email, 'Welcome to LuxuryStay', 'Your email is verified. Welcome to your workspace!');
  }
  await audit({ ...req, user }, changing ? 'account.email_change' : 'account.email_verified', user._id);
  res.json({ success: true, message: changing ? 'Email updated. Sign in with your new address.' : 'Your email address is verified.', signedOut: changing });
}

async function confirmPassword(req) {
  const user = await User.findById(req.user._id).select('+password +authVersion');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  return user;
}
export async function changePassword(req, res) {
  const user = await confirmPassword(req);
  const password = await bcrypt.hash(req.body.password, 12);
  const result = await User.updateOne({ _id: user._id, password: user.password }, {
    $set: { password }, $inc: { authVersion: 1 }, $unset: { refreshTokenHash: 1, resetHash: 1, resetExpires: 1,
      pendingEmail: 1, verificationHash: 1, verificationExpires: 1, verificationSentAt: 1 },
  });
  if (!result.modifiedCount) throw new ApiError(409, 'Account changed. Sign in and try again.');
  await Session.deleteMany({ user: user._id });
  clearCookies(res);
  await audit({ ...req, user }, 'account.password_change', user._id);
  await queueEmail(user.email, 'Your password was changed', 'Your password was changed. All devices have been signed out.');
  res.json({ success: true, message: 'Password changed. Sign in again on each device.' });
}
export async function changeEmail(req, res) {
  const user = await confirmPassword(req);
  if (user.email === req.body.email) throw new ApiError(400, 'Choose a different email address');
  if (await User.exists({ email: req.body.email })) throw new ApiError(409, 'That email address is unavailable');
  if (!(await requestVerification(user, req.body.email))) throw new ApiError(429, 'Wait one minute before requesting another email');
  await audit(req, 'account.email_change_requested', req.user._id);
  res.json({ success: true, message: 'Check your new email address to confirm. Your current address stays active until then.' });
}
export async function cancelEmailChange(req, res) {
  await User.updateOne({ _id: req.user._id, pendingEmail: { $exists: true } },
    { $unset: { pendingEmail: 1, verificationHash: 1, verificationExpires: 1, verificationSentAt: 1 } });
  await audit(req, 'account.email_change_cancelled', req.user._id);
  res.json({ success: true, message: 'Pending email change cancelled' });
}
export async function updateProfile(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { name: req.body.name } }, { returnDocument: 'after', runValidators: true });
  await audit({ ...req, user }, 'account.profile_update', user._id);
  res.json({ success: true, user });
}
export async function listSessions(req, res) {
  const sessions = await Session.find({ user: req.user._id, authVersion: req.user.authVersion, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 }).select('userAgent createdAt lastUsedAt expiresAt');
  res.json({ success: true, sessions: sessions.map((s) => ({ ...s.toObject(), current: s.id === req.session.id })) });
}
export async function revokeSession(req, res) {
  const session = await Session.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!session) throw new ApiError(404, 'Session not found');
  const signedOut = session.id === req.session.id;
  if (signedOut) clearCookies(res);
  await audit(req, 'account.session_revoked', req.params.id);
  res.json({ success: true, signedOut });
}
export async function revokeOtherSessions(req, res) {
  await Session.deleteMany({ user: req.user._id, _id: { $ne: req.session._id } });
  await audit(req, 'account.other_sessions_revoked', req.user._id);
  res.json({ success: true, message: 'Other sessions signed out' });
}
export async function uploadAvatar(req, res) {
  const type = await inspectMedia(req.file);
  if (type.kind !== 'image') throw new ApiError(415, 'Choose a JPEG, PNG, WebP, or GIF image');
  const adapter = storageFor(uploadProvider);
  const key = await adapter.save({ buffer: req.file.buffer, extension: type.ext });
  let previous;
  try {
    previous = await User.findByIdAndUpdate(req.user._id, { $set: {
      avatar: { key, provider: uploadProvider, mimeType: type.mime, kind: 'image' }, hasAvatar: true,
    } }).select('+avatar');
    if (!previous) throw new ApiError(404, 'Account not found');
  } catch (error) { await adapter.remove(key); throw error; }
  if (previous.avatar) await storageFor(previous.avatar.provider).remove(previous.avatar.key);
  await audit(req, 'account.avatar_update', req.user._id);
  res.json({ success: true, user: await User.findById(req.user._id) });
}
export async function getAvatar(req, res) {
  const user = await User.findById(req.user._id).select('+avatar');
  if (!user?.avatar) throw new ApiError(404, 'No profile photo');
  await storageFor(user.avatar.provider).send(req, res, user.avatar);
}
export async function deleteAvatar(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, { $unset: { avatar: 1 }, $set: { hasAvatar: false } }).select('+avatar');
  if (user.avatar) await storageFor(user.avatar.provider).remove(user.avatar.key);
  await audit(req, 'account.avatar_update', req.user._id);
  res.json({ success: true, user: await User.findById(req.user._id) });
}
export async function listAudit(req, res) {
  const { page, limit, action, search, role } = req.query;
  const conditions = [];
  if (action) conditions.push({ action });
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    const users = await User.find({ name: pattern }).select('_id');
    conditions.push({ $or: [{ 'actorSnapshot.name': pattern }, { 'actorSnapshot.id': pattern },
      { target: pattern }, { actor: { $in: users.map((u) => u._id) } },
      ...(/^[a-f\d]{24}$/i.test(search) ? [{ actor: search }] : [])] });
  }
  if (role) {
    const users = await User.find({ role }).select('_id');
    conditions.push({ $or: [{ 'actorSnapshot.role': role },
      { 'actorSnapshot.role': { $exists: false }, actor: { $in: users.map((u) => u._id) } }] });
  }
  const filter = conditions.length ? { $and: conditions } : {};
  const [events, total, actions] = await Promise.all([
    AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditEvent.countDocuments(filter),
    AuditEvent.distinct('action'),
  ]);
  // Preserve the raw ID even when an older event points at a deleted account.
  for (const event of events) event.actorId = String(event.actor);
  await AuditEvent.populate(events, { path: 'actor', select: 'name role' });
  res.json({ success: true, events, actions: actions.sort(), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
