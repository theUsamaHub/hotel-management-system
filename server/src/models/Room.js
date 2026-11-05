import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  number: { type: String, required: true, trim: true, maxlength: 20 },
  floor: { type: String, default: '', maxlength: 30 },
  status: { type: String, enum: ['available', 'occupied', 'cleaning', 'maintenance'], default: 'available' },
  isActive: { type: Boolean, default: true },
  maintenanceBlocked: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ hotel: 1, number: 1 }, { unique: true });
schema.index({ hotel: 1, roomType: 1, isActive: 1 });
export default mongoose.model('Room', schema);
