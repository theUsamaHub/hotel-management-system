import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledFor: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  open: { type: Boolean, default: true }, required: { type: Boolean, default: false },
  notes: { type: String, default: '', maxlength: 1000 },
  completionNotes: { type: String, default: '', maxlength: 1000 },
  startedAt: Date, completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ room: 1 }, { unique: true, partialFilterExpression: { open: true } });
schema.index({ hotel: 1, assignedTo: 1, status: 1 });
export default mongoose.model('HousekeepingTask', schema);
