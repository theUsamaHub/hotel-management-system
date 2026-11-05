import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true, unique: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });
schema.index({ hotel: 1, rating: 1, createdAt: -1 });
export default mongoose.model('GuestFeedback', schema);
