import { randomUUID } from 'node:crypto';
const startedAt = new Date();
const counters = { requests: 0, serverErrors: 0, slowRequests: 0, durationMs: 0, maximumMs: 0 };
export function monitoring(req, res, next) {
  const start = process.hrtime.bigint();
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.once('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    counters.requests += 1;
    counters.durationMs += ms;
    counters.maximumMs = Math.max(counters.maximumMs, ms);
    if (ms > 2000) counters.slowRequests += 1;
    if (res.statusCode >= 500) {
      counters.serverErrors += 1;
      // Never log request bodies, URLs, credentials, or exception messages.
      if (process.env.NODE_ENV !== 'test') console.error(JSON.stringify({ event: 'request_error', requestId: req.requestId, method: req.method, status: res.statusCode }));
    }
  });
  next();
}
export function metrics() {
  return { startedAt, uptimeSeconds: Math.floor(process.uptime()), requests: counters.requests, serverErrors: counters.serverErrors, slowRequests: counters.slowRequests, averageMs: counters.requests ? counters.durationMs / counters.requests : 0, maximumMs: counters.maximumMs, memoryRssBytes: process.memoryUsage().rss };
}
