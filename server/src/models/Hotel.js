import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  isActive: { type: Boolean, default: true },
  operationVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

export default mongoose.model('Hotel', hotelSchema);
