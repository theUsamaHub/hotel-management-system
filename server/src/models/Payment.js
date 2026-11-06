import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true, index: true },
  amount: { type: Number, required: true, min: 1 }, currency: { type: String, required: true },
  method: { type: String, enum: ['cash', 'card', 'bank_transfer'], required: true },
  reference: { type: String, required: true, trim: true, uppercase: true, maxlength: 120 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ hotel: 1, createdAt: 1 });
schema.index({ hotel: 1, reference: 1 }, { unique: true });
export default mongoose.model('Payment', schema);
