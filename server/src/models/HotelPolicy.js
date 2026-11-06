import mongoose from 'mongoose';
export const policyDefaults = { maxAdvanceDays: 730, maxStayNights: 365, cancellationDays: 0, taxBps: 0, allowSameDay: true, checkInHour: 0, checkOutHour: 0, weekendRateBps: 10000 };
export const policyFields = {
  maxAdvanceDays: { type: Number, default: 730, min: 0, max: 730 },
  maxStayNights: { type: Number, default: 365, min: 1, max: 365 },
  cancellationDays: { type: Number, default: 0, min: 0, max: 365 },
  taxBps: { type: Number, default: 0, min: 0, max: 10000 },
  allowSameDay: { type: Boolean, default: true },
  checkInHour: { type: Number, default: 0, min: 0, max: 23 },
  checkOutHour: { type: Number, default: 0, min: 0, max: 23 },
  weekendRateBps: { type: Number, default: 10000, min: 1000, max: 30000 },
};
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, unique: true },
  version: { type: Number, default: 0 },
  isOverride: { type: Boolean, default: true },
  ...policyFields,
}, { timestamps: true });
export default mongoose.model('HotelPolicy', schema);
