import Stay from '../models/Stay.js';
import StayKey from '../models/StayKey.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import User from '../models/User.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import AuditEvent from '../models/AuditEvent.js';
import ApiError from '../utils/ApiError.js';
import escapeRegex from '../utils/escapeRegex.js';
import { audit } from '../utils/audit.js';
import { queueEmail } from '../utils/email.js';
import { hotelAccess, paged, transact, today, roomState, ensureCleaning, syncMaintenance } from '../services/hotelOperations.js';

const manage = (req) => ['admin', 'manager'].includes(req.user.role);
const desk = (req) => ['admin', 'manager', 'receptionist'].includes(req.user.role);
const populatedTask = [{ path: 'room', select: 'number status maintenanceBlocked' }, { path: 'assignedTo', select: 'name role isActive' }];
const checkVersion = (record, version) => { if (record.version !== version) throw new ApiError(409, 'Record changed. Refresh before trying again'); };
async function assigned(id, role, hotel, session) {
  if (id && !await User.exists({ _id: id, role, hotel, isActive: true }).session(session)) throw new ApiError(400, `Select active ${role} staff assigned to this hotel`);
}
async function roomFor(req, id, hotel, session) {
  await hotelAccess(req, hotel, session, true, true);
  const room = await Room.findOne({ _id: id, hotel }).session(session);
  if (!room) throw new ApiError(404, 'Room not found');
  return room;
}
async function stayFor(req, id, session) {
  const stay = await Stay.findOne({ _id: id, ...(req.user.role === 'user' ? { owner: req.user._id } : {}) }).session(session || null);
  if (!stay) throw new ApiError(404, 'Stay not found');
  await hotelAccess(req, stay.hotel, session, false, !!session);
  return stay;
}
async function taskFor(req, Model, id, session) {
  const task = await Model.findById(id).session(session || null);
  if (!task) throw new ApiError(404, 'Work record not found');
  await hotelAccess(req, task.hotel, session, false, !!session);
  if (!desk(req) && String(task.assignedTo) !== String(req.user._id) && String(task.reportedBy) !== String(req.user._id)) throw new ApiError(404, 'Work record not found');
  return task;
}
function mayPerform(req, task, role) {
  if (!manage(req) && !(req.user.role === role && String(task.assignedTo) === String(req.user._id))) throw new ApiError(403, 'Only the assigned worker or a manager can perform this action');
}
export async function assignees(req, res) {
  await hotelAccess(req, req.query.hotel);
  const filter = { hotel: req.query.hotel, role: req.query.role, isActive: true };
  const { page, limit, search } = req.query;
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  const [staff, total] = await Promise.all([User.find(filter).select('name role').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
  res.json({ success: true, staff, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function checkIn(req, res) {
  let stay;
  await transact(async (session) => {
    const booking = await Reservation.findById(req.params.id).session(session);
    if (!booking) throw new ApiError(404, 'Reservation not found');
    const room = await roomFor(req, booking.room, booking.hotel, session);
    checkVersion(booking, req.body.version);
    if (booking.status !== 'confirmed' || booking.checkIn > today() || booking.checkOut <= today()) throw new ApiError(409, 'Check-in requires a confirmed booking within its stay dates');
    if (!room.isActive || room.status !== 'available' || room.maintenanceBlocked) throw new ApiError(409, 'Room must be active, clean, unoccupied and free of maintenance blocks');
    if (await HousekeepingTask.exists({ room: room._id, open: true, required: true }).session(session)) throw new ApiError(409, 'Required cleaning is not complete');
    if (!await RoomType.exists({ _id: room.roomType, isActive: true, capacity: { $gte: booking.occupants } }).session(session)) throw new ApiError(409, 'Room type is inactive or capacity is insufficient');
    if (await Stay.exists({ room: room._id, status: 'active' }).session(session) || await Reservation.exists({ room: room._id, status: 'checked_in' }).session(session)) throw new ApiError(409, 'Room already has an active stay');
    [stay] = await Stay.create([{ hotel: booking.hotel, room: room._id, reservation: booking._id, guest: booking.guest, owner: booking.owner, checkedInBy: req.user._id, verificationNote: req.body.verificationNote }], { session });
    await StayKey.create(req.body.keys.map((label) => ({ hotel: booking.hotel, stay: stay._id, label, issuedBy: req.user._id })), { session, ordered: true });
    booking.status = 'checked_in'; booking.version += 1;
    await booking.save({ session });
    await roomState(req, room, 'occupied', `Guest checked in: ${booking.reference}`, session);
    await audit(req, 'stay.check_in', stay._id, { reservation: String(booking._id), keys: req.body.keys, reason: req.body.verificationNote }, session);
    await audit(req, 'reservation.check_in', booking._id, { stay: String(stay._id) }, session);
    await queueEmail(booking.contact.email, 'LuxuryStay check-in recorded', `Your arrival has been recorded for ${booking.reference}, room ${booking.quote.roomNumber}.`, undefined, session);
  });
  res.status(201).json({ success: true, stay });
}
export function roomSettlement(booking) {
  const extraNights = Math.max(0, Math.floor((Date.parse(today()) - Date.parse(booking.checkOut)) / 86400000));
  return { roomTotal: booking.quote.total + extraNights * booking.quote.rate, extraNights, currency: booking.quote.currency };
}
export async function listStays(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  const filter = { hotel: req.query.hotel, ...(req.query.status ? { status: req.query.status } : {}), ...(req.user.role === 'user' ? { owner: req.user._id } : {}) };
  if (req.query.search) {
    const matching = await Reservation.find({ hotel: req.query.hotel, $or: ['reference', 'contact.name'].map((field) => ({ [field]: { $regex: escapeRegex(req.query.search), $options: 'i' } })) }).select('_id');
    filter.reservation = { $in: matching.map((r) => r._id) };
  }
  await paged(Stay, filter, req, res, 'stays', [{ path: 'reservation', select: 'reference contact checkIn checkOut quote status' }, { path: 'room', select: 'number status maintenanceBlocked' }]);
}
export async function stayDetail(req, res) {
  const stay = await stayFor(req, req.params.id);
  const booking = await Reservation.findById(stay.reservation);
  const keys = await StayKey.find({ stay: stay._id }).sort({ issuedAt: 1 });
  res.json({ success: true, stay, reservation: booking, keys, settlementDue: stay.status === 'active' ? roomSettlement(booking) : stay.settlement });
}
export async function issueKey(req, res) {
  let key;
  await transact(async (session) => {
    const stay = await stayFor(req, req.params.id, session);
    checkVersion(stay, req.body.version);
    if (stay.status !== 'active') throw new ApiError(409, 'Keys can only be issued for active stays');
    if (await StayKey.countDocuments({ stay: stay._id, status: 'issued' }).session(session) >= 5) throw new ApiError(409, 'Return an existing key before issuing more than five keys');
    [key] = await StayKey.create([{ hotel: stay.hotel, stay: stay._id, label: req.body.label, issuedBy: req.user._id }], { session });
    stay.version += 1; await stay.save({ session });
    await audit(req, 'stay.key_issued', stay._id, { label: key.label }, session);
  });
  res.status(201).json({ success: true, key });
}
export async function closeKey(req, res) {
  let key;
  await transact(async (session) => {
    const stay = await stayFor(req, req.params.id, session);
    checkVersion(stay, req.body.version);
    if (stay.status !== 'active') throw new ApiError(409, 'Stay is already completed');
    key = await StayKey.findOne({ _id: req.params.keyId, stay: stay._id, status: 'issued' }).session(session);
    if (!key) throw new ApiError(409, 'Key is not currently issued for this stay');
    key.set({ status: req.body.status, note: req.body.note, closedAt: new Date(), closedBy: req.user._id });
    await key.save({ session });
    if (key.status === 'lost') {
      const [issue] = await MaintenanceRequest.create([{ hotel: stay.hotel, room: stay.room, reportedBy: req.user._id, title: 'Lost room key — secure access', description: `Key ${key.label} reported lost. ${key.note}`, priority: 'urgent', blocksRoom: true }], { session });
      await syncMaintenance(req, await Room.findById(stay.room).session(session), 'Lost key requires access reset', session);
      await audit(req, 'maintenance.create', issue._id, { reason: 'Lost key; reset room access before returning to service' }, session);
    }
    stay.version += 1; await stay.save({ session });
    await audit(req, `stay.key_${key.status}`, stay._id, { label: key.label, reason: key.note }, session);
  });
  res.json({ success: true, key });
}
export async function checkout(req, res) {
  let stay;
  await transact(async (session) => {
    stay = await stayFor(req, req.params.id, session);
    checkVersion(stay, req.body.version);
    if (stay.status !== 'active') throw new ApiError(409, 'Stay is already completed');
    const booking = await Reservation.findById(stay.reservation).session(session);
    const room = await Room.findById(stay.room).session(session);
    if (booking.status !== 'checked_in' || room.status !== 'occupied') throw new ApiError(409, 'Stay and room state must be reconciled before checkout');
    if (await StayKey.exists({ stay: stay._id, status: 'issued' }).session(session)) throw new ApiError(409, 'Record return or loss of every issued key before checkout');
    const due = roomSettlement(booking);
    if (req.body.amount !== due.roomTotal || req.body.currency !== due.currency) throw new ApiError(409, 'Recorded settlement must match the current room total and currency');
    stay.set({ status: 'completed', checkedOutAt: new Date(), checkedOutBy: req.user._id, version: stay.version + 1,
      settlement: { ...due, amount: req.body.amount, method: req.body.method, reference: req.body.reference, reviewedAt: new Date(), reviewedBy: req.user._id } });
    await stay.save({ session });
    booking.status = 'checked_out'; booking.version += 1; await booking.save({ session });
    await roomState(req, room, room.maintenanceBlocked ? 'maintenance' : 'cleaning', `Guest checked out: ${booking.reference}`, session);
    const task = await ensureCleaning(req, room, 'Departure cleaning required', session);
    await audit(req, 'stay.check_out', stay._id, { settlement: stay.settlement.toObject(), cleaningTask: String(task._id) }, session);
    await audit(req, 'reservation.check_out', booking._id, { stay: String(stay._id) }, session);
    await queueEmail(booking.contact.email, 'LuxuryStay check-out recorded', `Your departure for ${booking.reference} has been recorded. Room-only external settlement: ${(due.roomTotal / 100).toFixed(2)} ${due.currency}. Reference: ${req.body.reference}. This is not a tax invoice.`, undefined, session);
  });
  res.json({ success: true, stay });
}
export async function stayHistory(req, res) {
  await stayFor(req, req.params.id);
  await paged(AuditEvent, { target: req.params.id, action: /^stay\./ }, req, res, 'events');
}
export async function housekeepingQueue(req, res) {
  await hotelAccess(req, req.query.hotel);
  await paged(Room, { hotel: req.query.hotel, status: 'cleaning' }, req, res, 'rooms');
}
export async function listHousekeeping(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  const filter = { hotel: req.query.hotel, ...(req.query.status ? { status: req.query.status } : {}), ...(!desk(req) ? { assignedTo: req.user._id } : {}) };
  if (req.query.search) filter.notes = { $regex: escapeRegex(req.query.search), $options: 'i' };
  await paged(HousekeepingTask, filter, req, res, 'tasks', populatedTask);
}
export async function createHousekeeping(req, res) {
  let task;
  await transact(async (session) => {
    const room = await roomFor(req, req.body.room, req.body.hotel, session);
    await assigned(req.body.assignedTo, 'housekeeping', room.hotel, session);
    [task] = await HousekeepingTask.create([{ ...req.body, createdBy: req.user._id, required: room.status === 'cleaning' || room.status === 'maintenance' }], { session });
    await audit(req, 'housekeeping.create', task._id, { assignedTo: req.body.assignedTo, scheduledFor: req.body.scheduledFor, reason: req.body.notes }, session);
  });
  res.status(201).json({ success: true, task });
}
export async function editHousekeeping(req, res) {
  let task;
  await transact(async (session) => {
    task = await taskFor(req, HousekeepingTask, req.params.id, session);
    checkVersion(task, req.body.version);
    if (!task.open) throw new ApiError(409, 'Completed cleaning tasks are immutable');
    await assigned(req.body.assignedTo, 'housekeeping', task.hotel, session);
    task.set({ assignedTo: req.body.assignedTo, scheduledFor: req.body.scheduledFor, notes: req.body.notes, version: task.version + 1 });
    await task.save({ session });
    await audit(req, 'housekeeping.assign', task._id, { assignedTo: req.body.assignedTo, scheduledFor: req.body.scheduledFor, reason: req.body.notes }, session);
  });
  res.json({ success: true, task });
}
export async function actHousekeeping(req, res) {
  let task;
  await transact(async (session) => {
    task = await taskFor(req, HousekeepingTask, req.params.id, session);
    mayPerform(req, task, 'housekeeping'); checkVersion(task, req.body.version);
    const room = await Room.findById(task.room).session(session);
    if (!task.open || room.status === 'occupied' || room.status === 'maintenance' || room.maintenanceBlocked || await Stay.exists({ room: room._id, status: 'active' }).session(session)) throw new ApiError(409, 'Room must be vacant and free of maintenance blocks before cleaning');
    if (req.body.action === 'start') {
      if (task.status !== 'pending' || task.scheduledFor > new Date()) throw new ApiError(409, 'Only pending tasks due now can be started');
      task.status = 'in_progress'; task.startedAt = new Date();
      await roomState(req, room, 'cleaning', req.body.notes, session);
    } else {
      if (task.status !== 'in_progress') throw new ApiError(409, 'Start cleaning before completing the task');
      task.set({ status: 'completed', open: false, completedAt: new Date(), completedBy: req.user._id, completionNotes: req.body.notes });
      await roomState(req, room, 'available', req.body.notes, session);
    }
    task.version += 1; await task.save({ session });
    await audit(req, `housekeeping.${req.body.action}`, task._id, { reason: req.body.notes }, session);
  });
  res.json({ success: true, task });
}
export async function housekeepingHistory(req, res) {
  await taskFor(req, HousekeepingTask, req.params.id);
  await paged(AuditEvent, { target: req.params.id, action: /^housekeeping\./ }, req, res, 'events');
}
export async function listMaintenance(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  const filter = { hotel: req.query.hotel, ...(req.query.status ? { status: req.query.status } : {}) };
  if (!desk(req)) filter.$or = [{ reportedBy: req.user._id }, ...(req.user.role === 'maintenance' ? [{ assignedTo: req.user._id }] : [])];
  if (req.query.search) filter.title = { $regex: escapeRegex(req.query.search), $options: 'i' };
  await paged(MaintenanceRequest, filter, req, res, 'requests', populatedTask);
}
export async function createMaintenance(req, res) {
  let request;
  await transact(async (session) => {
    const room = await roomFor(req, req.body.room, req.body.hotel, session);
    if (req.user.role === 'user' && !await Stay.exists({ room: room._id, owner: req.user._id, status: 'active' }).session(session)) throw new ApiError(403, 'Guests may report issues only for their current room');
    if (!manage(req) && (req.body.blocksRoom || req.body.assignedTo)) throw new ApiError(403, 'Only managers can block rooms or assign repairs');
    await assigned(req.body.assignedTo, 'maintenance', room.hotel, session);
    [request] = await MaintenanceRequest.create([{ ...req.body, reportedBy: req.user._id }], { session });
    await syncMaintenance(req, room, req.body.title, session);
    await audit(req, 'maintenance.create', request._id, { reason: req.body.description, blocksRoom: request.blocksRoom, priority: request.priority }, session);
  });
  res.status(201).json({ success: true, request });
}
export async function editMaintenance(req, res) {
  let request;
  await transact(async (session) => {
    request = await taskFor(req, MaintenanceRequest, req.params.id, session);
    checkVersion(request, req.body.version);
    if (request.status === 'resolved') throw new ApiError(409, 'Reopen this request before changing its assignment');
    // A blocking issue is cleared by resolution, never merely by unchecking a box.
    if (request.blocksRoom && !req.body.blocksRoom) throw new ApiError(409, 'Resolve the blocking issue to release the room');
    await assigned(req.body.assignedTo, 'maintenance', request.hotel, session);
    request.set({ assignedTo: req.body.assignedTo, priority: req.body.priority, blocksRoom: req.body.blocksRoom, version: request.version + 1 });
    await request.save({ session });
    await syncMaintenance(req, await Room.findById(request.room).session(session), request.title, session);
    await audit(req, 'maintenance.assign', request._id, { assignedTo: req.body.assignedTo, priority: request.priority, blocksRoom: request.blocksRoom }, session);
  });
  res.json({ success: true, request });
}
export async function actMaintenance(req, res) {
  let request;
  await transact(async (session) => {
    request = await taskFor(req, MaintenanceRequest, req.params.id, session);
    checkVersion(request, req.body.version);
    const action = req.body.action;
    if (action === 'reopen') {
      if (!manage(req)) throw new ApiError(403, 'Only managers can reopen repairs');
      if (request.status !== 'resolved') throw new ApiError(409, 'Only resolved requests can be reopened');
      request.set({ status: 'open', resolution: '', resolvedAt: undefined, resolvedBy: undefined });
    } else {
      mayPerform(req, request, 'maintenance');
      if (action === 'start') {
        if (request.status !== 'open') throw new ApiError(409, 'Only open repairs can be started');
        request.status = 'in_progress';
      } else {
        if (request.status !== 'in_progress') throw new ApiError(409, 'Start the repair before resolving it');
        request.set({ status: 'resolved', resolution: req.body.notes, resolvedAt: new Date(), resolvedBy: req.user._id });
      }
    }
    request.version += 1; await request.save({ session });
    await syncMaintenance(req, await Room.findById(request.room).session(session), req.body.notes, session);
    await audit(req, `maintenance.${action}`, request._id, { reason: req.body.notes }, session);
  });
  res.json({ success: true, request });
}
export async function maintenanceHistory(req, res) {
  await taskFor(req, MaintenanceRequest, req.params.id);
  await paged(AuditEvent, { target: req.params.id, action: /^maintenance\./ }, req, res, 'events');
}
export async function affectedBookings(req, res) {
  const request = await taskFor(req, MaintenanceRequest, req.params.id);
  await paged(Reservation, { room: request.room, $or: [{ status: 'checked_in' }, { status: { $in: ['pending', 'confirmed'] }, checkOut: { $gt: today() } }] }, req, res, 'reservations');
}
