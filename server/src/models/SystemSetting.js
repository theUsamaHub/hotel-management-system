import mongoose from 'mongoose';
import { policyFields } from './HotelPolicy.js';
const schema = new mongoose.Schema({
  key: { type: String, default: 'policies', unique: true, enum: ['policies'] },
  version: { type: Number, default: 0 },
  ...policyFields,
}, { timestamps: true });
export default mongoose.model('SystemSetting', schema);
