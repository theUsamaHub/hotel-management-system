import mongoose from 'mongoose';
const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required: true });
const schema = new mongoose.Schema({
  hotel: ref('Hotel'), room: ref('Room'), reservation: { ...ref('Reservation'), unique: true },
  guest: ref('GuestProfile'), owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  checkedInAt: { type: Date, default: Date.now }, checkedOutAt: Date,
  checkedInBy: ref('User'), checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationNote: { type: String, required: true, maxlength: 300 },
  version: { type: Number, default: 0 },
  settlement: {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    amount: Number, currency: String, roomTotal: Number, extraNights: Number,
    method: String, reference: String, reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
}, { timestamps: true });
schema.index({ room: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
schema.index({ hotel: 1, status: 1 });
schema.index({ hotel: 1, checkedInAt: 1, checkedOutAt: 1 });
export default mongoose.model('Stay', schema);
