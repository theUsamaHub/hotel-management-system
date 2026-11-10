import AuditEvent from '../models/AuditEvent.js';

export function audit(req, action, target, details = {}, session) {
  return AuditEvent.create([{ actor: req.user._id, actorSnapshot: { id: String(req.user._id), name: req.user.name, role: req.user.role }, action, target: String(target), details }], { session });
}
