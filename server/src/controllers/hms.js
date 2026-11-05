import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import RoomStatusLog from '../models/RoomStatusLog.js';
import GuestProfile from '../models/GuestProfile.js';
import Reservation from '../models/Reservation.js';
import AuditEvent from '../models/AuditEvent.js';
import ApiError from '../utils/ApiError.js';
import escapeRegex from '../utils/escapeRegex.js';
import { audit } from '../utils/audit.js';
import { queueEmail } from '../utils/email.js';

const activeStatuses = ['pending', 'confirmed', 'checked_in'];
const outstanding = () => ({ $or: [{ status: 'checked_in' }, { status: { $in: ['pending', 'confirmed'] }, checkOut: { $gt: today() } }] });
const today = () => new Date().toISOString().slice(0, 10);
const guestUser = (req) => req.user.role === 'user';
const day = 86400000;
export function dateRange(checkIn, checkOut) {
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / day;
  if (checkIn < today() || nights < 1 || nights > 365 || Date.parse(checkIn) - Date.parse(today()) > 730 * day) {
    throw new ApiError(400, 'Choose a future or same-day arrival within two years and a stay of 1–365 nights');
  }
  return nights;
}

async function hotelAccess(req, id, session, active = true, lock = false) {
  if (!['admin', 'user'].includes(req.user.role) && String(req.user.hotel) !== String(id)) throw new ApiError(404, 'Hotel not found');
  const filter = { _id: id, ...(active ? { isActive: true } : {}) };
  // All inventory/booking writers contend on the same hotel document. Transactions
  // retry with a fresh snapshot, preventing write-skew across separate reservations.
  const hotel = lock
    ? await Hotel.findOneAndUpdate(filter, { $inc: { operationVersion: 1 } }, { new: true, session })
    : await Hotel.findOne(filter).session(session || null);
  if (!hotel) throw new ApiError(404, 'Hotel not found or inactive');
  return hotel;
}
async function paged(Model, filter, req, res, key, populate) {
  const { page, limit } = req.query;
  let query = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  if (populate) query = query.populate(populate);
  const [records, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json({ success: true, [key]: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
const search = (value, fields) => value ? { $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(value), $options: 'i' } })) } : {};
const transact = (work) => mongoose.connection.transaction(work);

export async function catalog(req, res) {
  const filter = { ...search(req.query.search, ['name', 'city', 'code']) };
  if (guestUser(req)) {
    const previousHotels = await GuestProfile.distinct('hotel', { user: req.user._id });
    filter.$and = [{ $or: [{ isActive: true }, { _id: { $in: previousHotels } }] }];
  }
  if (!['admin', 'user'].includes(req.user.role)) filter._id = req.user.hotel;
  await paged(Hotel, filter, req, res, 'hotels');
}
export async function listTypes(req, res) {
  await hotelAccess(req, req.query.hotel);
  await paged(RoomType, { hotel: req.query.hotel, ...(guestUser(req) ? { isActive: true } : {}), ...search(req.query.search, ['name']) }, req, res, 'roomTypes');
}
export async function saveType(req, res) {
  let result;
  await transact(async (session) => {
    const existing = req.params.id ? await RoomType.findById(req.params.id).session(session) : null;
    if (req.params.id && !existing) throw new ApiError(404, 'Room type not found');
    const hotel = existing?.hotel || req.body.hotel;
    await hotelAccess(req, hotel, session, true, true);
    if (existing) {
      const rooms = await Room.find({ roomType: existing._id }).select('_id').session(session);
      if ((!req.body.isActive || req.body.capacity < existing.capacity) && await Reservation.exists({ room: { $in: rooms.map((room) => room._id) }, ...outstanding(), ...(req.body.isActive ? { occupants: { $gt: req.body.capacity } } : {}) }).session(session)) throw new ApiError(409, 'This change would invalidate an existing reservation');
      existing.set(req.body);
      result = await existing.save({ session });
    } else [result] = await RoomType.create([req.body], { session });
    await audit(req, existing ? 'room_type.update' : 'room_type.create', result._id, { hotel: String(hotel), rate: result.rate, currency: result.currency, isActive: result.isActive }, session);
  });
  res.status(req.params.id ? 200 : 201).json({ success: true, roomType: result });
}
export async function listRooms(req, res) {
  await hotelAccess(req, req.query.hotel);
  await paged(Room, { hotel: req.query.hotel, ...search(req.query.search, ['number', 'floor']) }, req, res, 'rooms', 'roomType');
}
async function futureBookings(room, session) {
  return Reservation.exists({ room, ...outstanding() }).session(session);
}
export async function saveRoom(req, res) {
  let result;
  await transact(async (session) => {
    const existing = req.params.id ? await Room.findById(req.params.id).session(session) : null;
    if (req.params.id && !existing) throw new ApiError(404, 'Room not found');
    const hotel = existing?.hotel || req.body.hotel;
    await hotelAccess(req, hotel, session, true, true);
    if (!await RoomType.exists({ _id: req.body.roomType, hotel, isActive: true }).session(session)) throw new ApiError(400, 'Select an active room type belonging to this hotel');
    if (existing) {
      if ((!req.body.isActive || String(existing.roomType) !== req.body.roomType || existing.number !== req.body.number) && await futureBookings(existing._id, session)) throw new ApiError(409, 'Cancel or reassign active reservations before changing room identity or deactivating it');
      existing.set(req.body);
      result = await existing.save({ session });
    } else {
      [result] = await Room.create([req.body], { session });
      await RoomStatusLog.create([{ hotel, room: result._id, actor: req.user._id, to: 'available', reason: 'Room added to inventory' }], { session });
    }
    await audit(req, existing ? 'room.update' : 'room.create', result._id, { hotel: String(hotel), isActive: result.isActive }, session);
  });
  res.status(req.params.id ? 200 : 201).json({ success: true, room: result });
}
export async function changeRoomStatus(req, res) {
  let room;
  await transact(async (session) => {
    room = await Room.findById(req.params.id).session(session);
    if (!room) throw new ApiError(404, 'Room not found');
    await hotelAccess(req, room.hotel, session, true, true);
    const from = room.status;
    const to = req.body.status;
    if (from === to || from === 'occupied') throw new ApiError(409, 'Invalid status transition; occupied rooms require check-out');
    if (from === 'maintenance' && to !== 'cleaning') throw new ApiError(409, 'Repaired rooms must pass through cleaning');
    if (req.user.role === 'housekeeping' && !(from === 'cleaning' && to === 'available')) throw new ApiError(403, 'Housekeeping can only mark cleaned rooms ready');
    if (req.user.role === 'maintenance' && !(from === 'maintenance' && to === 'cleaning')) throw new ApiError(403, 'Maintenance can only release repaired rooms for cleaning');
    if (to === 'maintenance' && await futureBookings(room._id, session)) throw new ApiError(409, 'Reassign or cancel active reservations before blocking this room');
    room.status = to;
    await room.save({ session });
    await RoomStatusLog.create([{ hotel: room.hotel, room: room._id, actor: req.user._id, from, to, reason: req.body.reason }], { session });
    await audit(req, 'room.status', room._id, { from, to, reason: req.body.reason }, session);
  });
  res.json({ success: true, room });
}
export async function roomHistory(req, res) {
  const room = await Room.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found');
  await hotelAccess(req, room.hotel, null, false);
  await paged(RoomStatusLog, { room: room._id }, req, res, 'events', { path: 'actor', select: 'name' });
}
export async function listGuests(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  await paged(GuestProfile, { hotel: req.query.hotel, ...(guestUser(req) ? { user: req.user._id } : {}), ...search(req.query.search, ['name', 'email', 'phone']) }, req, res, 'guests');
}
export async function saveGuest(req, res) {
  let guest;
  await transact(async (session) => {
    guest = req.params.id ? await GuestProfile.findOne({ _id: req.params.id, ...(guestUser(req) ? { user: req.user._id } : {}) }).session(session) : null;
    if (req.params.id && !guest) throw new ApiError(404, 'Guest profile not found');
    await hotelAccess(req, guest?.hotel || req.body.hotel, session, true, true);
    if (guest) { guest.set(req.body); await guest.save({ session }); }
    else [guest] = await GuestProfile.create([{ ...req.body, user: guestUser(req) ? req.user._id : null }], { session });
    await audit(req, req.params.id ? 'guest.update' : 'guest.create', guest._id, { hotel: String(guest.hotel) }, session);
  });
  res.status(req.params.id ? 200 : 201).json({ success: true, guest });
}
const overlap = (checkIn, checkOut) => ({ status: { $in: activeStatuses }, checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } });
async function accessibleBooking(req, id, session) {
  const booking = await Reservation.findOne({ _id: id, ...(guestUser(req) ? { owner: req.user._id } : {}) }).session(session || null);
  if (!booking) throw new ApiError(404, 'Reservation not found');
  await hotelAccess(req, booking.hotel, session, false);
  return booking;
}
export async function availability(req, res) {
  const { hotel, checkIn, checkOut, occupants, roomType, excludeReservation } = req.query;
  dateRange(checkIn, checkOut);
  await hotelAccess(req, hotel);
  if (excludeReservation) {
    const excluded = await accessibleBooking(req, excludeReservation);
    if (String(excluded.hotel) !== hotel || !['pending', 'confirmed'].includes(excluded.status)) throw new ApiError(400, 'Invalid reservation to modify');
  }
  const booked = await Reservation.distinct('room', { hotel, ...overlap(checkIn, checkOut), ...(excludeReservation ? { _id: { $ne: excludeReservation } } : {}) });
  const types = await RoomType.find({ hotel, isActive: true, capacity: { $gte: occupants }, ...(roomType ? { _id: roomType } : {}) }).select('_id');
  await paged(Room, { hotel, isActive: true, status: checkIn === today() ? 'available' : { $ne: 'maintenance' }, roomType: { $in: types.map((type) => type._id) }, _id: { $nin: booked } }, req, res, 'rooms', 'roomType');
}
async function selectRoom(req, data, booking, session) {
  const nights = dateRange(data.checkIn, data.checkOut);
  const room = await Room.findOne({ _id: data.room, hotel: booking.hotel, isActive: true, status: data.checkIn === today() ? 'available' : { $ne: 'maintenance' } }).session(session);
  if (!room) throw new ApiError(409, 'Room is inactive, blocked, or not ready for this arrival');
  const type = await RoomType.findOne({ _id: room.roomType, hotel: booking.hotel, isActive: true, capacity: { $gte: data.occupants } }).session(session);
  if (!type) throw new ApiError(409, 'Room type is inactive or capacity is insufficient');
  if (await Reservation.exists({ room: room._id, ...overlap(data.checkIn, data.checkOut), ...(booking._id ? { _id: { $ne: booking._id } } : {}) }).session(session)) throw new ApiError(409, 'Room is already reserved for these dates');
  const unchangedRoom = String(booking.room) === String(room._id) && booking.quote;
  const rate = unchangedRoom ? booking.quote.rate : type.rate;
  return { roomNumber: room.number, roomType: unchangedRoom ? booking.quote.roomType : type.name, rate, currency: unchangedRoom ? booking.quote.currency : type.currency, nights, total: rate * nights };
}
async function notification(booking, event, session) {
  await queueEmail(booking.contact.email, `LuxuryStay reservation ${event}`, `${booking.contact.name},\nReservation: ${booking.reference}\nStatus: ${booking.status}\nArrival: ${booking.checkIn}\nDeparture: ${booking.checkOut}\nRoom: ${booking.quote.roomNumber}\nRoom subtotal: ${(booking.quote.total / 100).toFixed(2)} ${booking.quote.currency}\nTaxes and additional services are not included.`, undefined, session);
}
export async function createBooking(req, res) {
  let booking;
  await transact(async (session) => {
    await hotelAccess(req, req.body.hotel, session, true, true);
    const guest = await GuestProfile.findOne({ _id: req.body.guest, hotel: req.body.hotel, ...(guestUser(req) ? { user: req.user._id } : {}) }).session(session);
    if (!guest) throw new ApiError(404, 'Guest profile not found');
    const quote = await selectRoom(req, req.body, { hotel: req.body.hotel }, session);
    [booking] = await Reservation.create([{ ...req.body, quote, owner: guest.user, createdBy: req.user._id, contact: { name: guest.name, email: guest.email, phone: guest.phone } }], { session });
    await audit(req, 'reservation.create', booking._id, { hotel: String(booking.hotel), checkIn: booking.checkIn, checkOut: booking.checkOut, quote }, session);
    await notification(booking, 'received', session);
  });
  res.status(201).json({ success: true, reservation: booking });
}
export async function listBookings(req, res) {
  const { hotel, status, from, to } = req.query;
  if (from && to && from > to) throw new ApiError(400, 'Invalid date filter');
  await hotelAccess(req, hotel, null, false);
  await paged(Reservation, { hotel, ...(guestUser(req) ? { owner: req.user._id } : {}), ...(status ? { status } : {}), ...(from || to ? { checkIn: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}), ...search(req.query.search, ['reference', 'contact.name']) }, req, res, 'reservations');
}
export async function getBooking(req, res) {
  res.json({ success: true, reservation: await accessibleBooking(req, req.params.id) });
}
export async function bookingHistory(req, res) {
  await accessibleBooking(req, req.params.id);
  await paged(AuditEvent, { target: req.params.id, action: /^reservation\./ }, req, res, 'events');
}
export async function updateBooking(req, res) {
  let booking;
  await transact(async (session) => {
    booking = await accessibleBooking(req, req.params.id, session);
    const action = req.params.action || 'update';
    await hotelAccess(req, booking.hotel, session, action !== 'cancel', true);
    if (!['pending', 'confirmed'].includes(booking.status) || booking.version !== req.body.version) throw new ApiError(409, 'Reservation changed or cannot be edited; refresh and try again');
    if (action !== 'cancel' || guestUser(req)) dateRange(booking.checkIn, booking.checkOut);
    const before = { room: String(booking.room), checkIn: booking.checkIn, checkOut: booking.checkOut, status: booking.status, quote: booking.quote.toObject() };
    if (action === 'confirm') {
      if (booking.status !== 'pending') throw new ApiError(409, 'Only pending bookings can be confirmed');
      await selectRoom(req, booking, booking, session);
      booking.status = 'confirmed';
    } else if (action === 'cancel') {
      booking.status = 'cancelled'; booking.cancellationReason = req.body.reason;
    } else {
      const quote = await selectRoom(req, req.body, booking, session);
      booking.set({ room: req.body.room, checkIn: req.body.checkIn, checkOut: req.body.checkOut, occupants: req.body.occupants, notes: req.body.notes, quote });
    }
    booking.version += 1;
    await booking.save({ session });
    await audit(req, `reservation.${action}`, booking._id, { before, after: { room: String(booking.room), checkIn: booking.checkIn, checkOut: booking.checkOut, status: booking.status, quote: booking.quote.toObject() }, reason: req.body.reason || '' }, session);
    await notification(booking, action === 'update' ? 'updated' : booking.status, session);
  });
  res.json({ success: true, reservation: booking });
}
