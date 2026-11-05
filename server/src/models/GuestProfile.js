import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  preferences: { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });
schema.index({ hotel: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });
export default mongoose.model('GuestProfile', schema);
