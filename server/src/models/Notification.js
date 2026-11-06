import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, maxlength: 300 },
  module: { type: String, enum: ['reservations', 'housekeeping', 'maintenance', 'billing'], required: true },
  target: { type: mongoose.Schema.Types.ObjectId, required: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ recipient: 1, hotel: 1, readAt: 1, createdAt: -1 });
export default mongoose.model('Notification', schema);
