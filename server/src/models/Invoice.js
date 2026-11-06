import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true, unique: true },
  number: { type: String, default: () => `INV-${randomUUID()}`, unique: true },
  status: { type: String, enum: ['draft', 'issued'], default: 'draft' },
  taxBps: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, discountReason: { type: String, default: '', maxlength: 300 },
  currency: String, roomTotal: Number, extraNights: Number, subtotal: Number, tax: Number, total: Number,
  lines: [{ description: String, quantity: Number, unitAmount: Number, total: Number }],
  guest: { name: String, email: String, phone: String },
  property: { name: String, address: String, city: String, country: String, email: String, phone: String },
  bookingReference: String, issuedAt: Date, lastEmailedAt: Date,
}, { timestamps: true });
schema.index({ hotel: 1, status: 1, issuedAt: 1 });
export default mongoose.model('Invoice', schema);
