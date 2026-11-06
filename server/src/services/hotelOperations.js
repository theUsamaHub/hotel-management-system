import { notifyHotel } from './notifications.js';
import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import RoomStatusLog from '../models/RoomStatusLog.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import ApiError from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const transact = (work) => mongoose.connection.transaction(work);
export const today = () => new Date().toISOString().slice(0, 10);
export async function hotelAccess(req, id, session, active = true, lock = false) {
  if (!['admin', 'user'].includes(req.user.role) && String(req.user.hotel) !== String(id)) throw new ApiError(404, 'Hotel not found');
  const filter = { _id: id, ...(active ? { isActive: true } : {}) };
  const hotel = lock
    ? await Hotel.findOneAndUpdate(filter, { $inc: { operationVersion: 1 } }, { new: true, session })
    : await Hotel.findOne(filter).session(session || null);
  if (!hotel) throw new ApiError(404, 'Hotel not found or inactive');
  return hotel;
}
export async function paged(Model, filter, req, res, key, populate) {
  const { page, limit } = req.query;
  let query = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  if (populate) query = query.populate(populate);
  const [records, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json({ success: true, [key]: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function roomState(req, room, status, reason, session) {
  const from = room.status;
  room.status = status;
  await room.save({ session });
  await RoomStatusLog.create([{ hotel: room.hotel, room: room._id, actor: req.user._id, from, to: status, reason }], { session });
}
export async function ensureCleaning(req, room, reason, session) {
  let task = await HousekeepingTask.findOne({ room: room._id, open: true }).session(session);
  if (task) {
    task.required = true;
    task.version += 1;
    // A repair or checkout invalidates previously started cleaning.
    task.status = 'pending'; task.startedAt = undefined;
    task.scheduledFor = new Date();
    await task.save({ session });
  } else {
    [task] = await HousekeepingTask.create([{ hotel: room.hotel, room: room._id, required: true, scheduledFor: new Date(), notes: reason, createdBy: req.user._id }], { session });
  }
  await audit(req, 'housekeeping.required', task._id, { reason, room: String(room._id) }, session);
  await notifyHotel(room.hotel, 'housekeeping', task._id, `Room ${room.number} requires cleaning`, session);
  return task;
}
export async function syncMaintenance(req, room, reason, session) {
  const blocked = !!await MaintenanceRequest.exists({ room: room._id, blocksRoom: true, status: { $ne: 'resolved' } }).session(session);
  const wasBlocked = room.maintenanceBlocked;
  if (wasBlocked !== blocked) await notifyHotel(room.hotel, 'maintenance', room._id, `Room ${room.number}: booking block ${blocked ? 'applied' : 'cleared'}`, session);
  room.maintenanceBlocked = blocked;
  if (blocked && room.status !== 'occupied') await roomState(req, room, 'maintenance', reason, session);
  else if (wasBlocked && !blocked && room.status !== 'occupied') {
    await roomState(req, room, 'cleaning', reason, session);
    await ensureCleaning(req, room, reason, session);
  } else {
    await room.save({ session });
    if (wasBlocked !== blocked) await RoomStatusLog.create([{ hotel: room.hotel, room: room._id, actor: req.user._id, from: room.status, to: room.status, reason: `${blocked ? 'Booking blocked' : 'Booking block cleared'}: ${reason}` }], { session });
  }
}
