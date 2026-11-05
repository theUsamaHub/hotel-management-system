import mongoose from 'mongoose';
import { policyFields } from './HotelPolicy.js';
import { randomUUID } from 'node:crypto';
const schema = new mongoose.Schema({
  reference: { type: String, default: () => `LS-${randomUUID()}`, unique: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestProfile', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checkIn: { type: String, required: true }, checkOut: { type: String, required: true },
  occupants: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'], default: 'pending' },
  version: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 1000 },
  cancellationReason: { type: String, default: '', maxlength: 300 },
  // Immutable historical quote; later room pricing changes do not alter it.
  quote: {
    roomNumber: String, roomType: String, rate: Number, currency: String,
    nights: Number, total: Number,
  },
  policy: { type: new mongoose.Schema(policyFields, { _id: false }), default: undefined },
  contact: { name: String, email: String, phone: String },
}, { timestamps: true });
schema.index({ room: 1, status: 1, checkIn: 1, checkOut: 1 });
schema.index({ hotel: 1, createdAt: -1 });
schema.index({ hotel: 1, checkIn: 1, status: 1 });
schema.index({ owner: 1, createdAt: -1 });
export default mongoose.model('Reservation', schema);
