import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', required: true, index: true },
  serviceRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  description: { type: String, required: true, maxlength: 300 },
  quantity: { type: Number, required: true }, unitAmount: { type: Number, required: true },
  total: { type: Number, required: true }, currency: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['posted', 'voided'], default: 'posted' },
  voidReason: { type: String, maxlength: 300 }, voidedAt: Date,
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ serviceRequest: 1 }, { unique: true, partialFilterExpression: { serviceRequest: { $type: 'objectId' } } });
export default mongoose.model('BillingCharge', schema);
