import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  quantity: { type: Number, required: true },
  snapshot: { name: String, unitPrice: Number, currency: String },
  notes: { type: String, default: '', maxlength: 1000 },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  completionNotes: { type: String, default: '', maxlength: 1000 },
  completedAt: Date, version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ hotel: 1, status: 1 });
schema.index({ stay: 1, status: 1 });
export default mongoose.model('ServiceRequest', schema);
