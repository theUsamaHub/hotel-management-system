import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true, index: true },
  label: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
  status: { type: String, enum: ['issued', 'returned', 'lost'], default: 'issued' },
  issuedAt: { type: Date, default: Date.now }, issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  closedAt: Date, closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });
schema.index({ hotel: 1, label: 1 }, { unique: true, partialFilterExpression: { status: 'issued' } });
export default mongoose.model('StayKey', schema);
