import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 1000 },
  unitPrice: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['PKR', 'USD', 'EUR', 'GBP', 'AED'], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ hotel: 1, name: 1 }, { unique: true });
export default mongoose.model('Service', schema);
