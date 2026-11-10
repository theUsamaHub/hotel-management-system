import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorSnapshot: { id: String, name: String, role: String },
  action: { type: String, required: true },
  target: { type: String, required: true },
  // Only explicitly selected non-secret values belong in this record.
  details: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});
export default mongoose.model('AuditEvent', schema);
