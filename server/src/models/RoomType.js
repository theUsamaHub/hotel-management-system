import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 1000 },
  capacity: { type: Number, required: true, min: 1, max: 20 },
  rate: { type: Number, required: true, min: 0 }, // Integer minor currency units.
  currency: { type: String, enum: ['PKR', 'USD', 'EUR', 'GBP', 'AED'], default: 'PKR' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ hotel: 1, name: 1 }, { unique: true });
export default mongoose.model('RoomType', schema);
