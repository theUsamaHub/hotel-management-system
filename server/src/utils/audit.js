import AuditEvent from '../models/AuditEvent.js';

export function audit(req, action, target, details = {}, session) {
  return AuditEvent.create([{ actor: req.user._id, action, target: String(target), details }], { session });
}
