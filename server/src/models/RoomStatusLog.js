import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  from: String, to: { type: String, required: true }, reason: { type: String, required: true, maxlength: 300 },
}, { timestamps: true });
export default mongoose.model('RoomStatusLog', schema);
