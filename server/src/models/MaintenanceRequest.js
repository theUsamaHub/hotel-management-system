import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true, maxlength: 120 }, description: { type: String, required: true, maxlength: 2000 },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
  blocksRoom: { type: Boolean, default: false },
  resolution: { type: String, default: '', maxlength: 2000 }, resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ hotel: 1, status: 1, assignedTo: 1 });
schema.index({ room: 1, blocksRoom: 1, status: 1 });
export default mongoose.model('MaintenanceRequest', schema);
