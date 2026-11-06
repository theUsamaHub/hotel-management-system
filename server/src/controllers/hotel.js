import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import ApiError from '../utils/ApiError.js';
import escapeRegex from '../utils/escapeRegex.js';
import { STAFF_ROLES } from '../config/roles.js';
import { audit } from '../utils/audit.js';
import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';

export async function listHotels(req, res) {
  const { page, limit, search } = req.query;
  const filter = req.user.role === 'admin' ? {} : { _id: req.user.hotel, isActive: true };
  if (search) filter.$or = ['name', 'code', 'city'].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } }));
  const [hotels, total] = await Promise.all([
    Hotel.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit),
    Hotel.countDocuments(filter),
  ]);
  res.json({ success: true, hotels, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getHotel(req, res) {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') {
    if (String(req.user.hotel) !== req.params.id) throw new ApiError(404, 'Hotel not found');
    filter.isActive = true;
  }
  const hotel = await Hotel.findOne(filter);
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  res.json({ success: true, hotel });
}

export async function createHotel(req, res) {
  const hotel = await Hotel.create(req.body);
  await audit(req, 'hotel.create', hotel._id, { code: hotel.code });
  res.status(201).json({ success: true, hotel });
}

export async function updateHotel(req, res) {
  let hotel;
  await mongoose.connection.transaction(async (session) => {
    hotel = await Hotel.findByIdAndUpdate(req.params.id, { $set: req.body, $inc: { operationVersion: 1 } }, { new: true, runValidators: true, session });
    if (!hotel) throw new ApiError(404, 'Hotel not found');
    if (!hotel.isActive && await Reservation.exists({ hotel: hotel._id, $or: [{ status: 'checked_in' }, { status: { $in: ['pending', 'confirmed'] }, checkOut: { $gt: new Date().toISOString().slice(0, 10) } }] }).session(session)) throw new ApiError(409, 'Cancel or complete active reservations before deactivating the hotel');
    await audit(req, 'hotel.update', hotel._id, { isActive: hotel.isActive }, session);
  });
  res.json({ success: true, hotel });
}

export async function listStaff(req, res) {
  const { page, limit, search } = req.query;
  const filter = { role: { $in: STAFF_ROLES } };
  if (req.user.role !== 'admin') {
    const hotel = await Hotel.findOne({ _id: req.user.hotel, isActive: true });
    if (!hotel) throw new ApiError(403, 'An active hotel assignment is required');
    filter.hotel = hotel._id;
  }
  if (search) filter.$or = ['name', 'email'].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } }));
  const [staff, total] = await Promise.all([
    User.find(filter).populate('hotel', 'name code isActive').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, staff, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function requireActiveHotel(id) {
  if (!await Hotel.exists({ _id: id, isActive: true })) throw new ApiError(400, 'Select an active hotel');
}

export async function createStaff(req, res) {
  await requireActiveHotel(req.body.hotel);
  const user = await User.create(req.body);
  await audit(req, 'staff.create', user._id, { role: user.role, hotel: String(user.hotel) });
  res.status(201).json({ success: true, user });
}

export async function updateStaff(req, res) {
  if (String(req.user._id) === req.params.id) throw new ApiError(400, 'You cannot change your own access');
  const user = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } });
  if (!user) throw new ApiError(404, 'Staff member not found');
  if (req.body.isActive) await requireActiveHotel(req.body.hotel);
  else if (!await Hotel.exists({ _id: req.body.hotel })) throw new ApiError(400, 'Hotel not found');
  // Increment atomically so concurrent edits cannot resurrect an older session.
  const updated = await User.findByIdAndUpdate(user._id, {
    $set: req.body, $inc: { authVersion: 1 }, $unset: { refreshTokenHash: 1 },
  }, { new: true, runValidators: true });
  await Session.deleteMany({ user: user._id });
  await audit(req, 'staff.update', user._id, { role: updated.role, hotel: String(updated.hotel), isActive: updated.isActive });
  res.json({ success: true, user: updated });
}
