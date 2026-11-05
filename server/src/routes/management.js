import { metrics } from '../middleware/monitoring.js';
import { operationalReport } from '../services/reports.js';
import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { idParams, paginationQuery } from '../validators/user.js';
import { date } from '../validators/hms.js';
import { hotelAccess, paged, transact } from '../services/hotelOperations.js';
import { policyFor } from '../services/policies.js';
import { audit } from '../utils/audit.js';
import HotelPolicy, { policyDefaults } from '../models/HotelPolicy.js';
import SystemSetting from '../models/SystemSetting.js';
import Notification from '../models/Notification.js';
import Reservation from '../models/Reservation.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import GuestFeedback from '../models/GuestFeedback.js';
const router = Router();
const id = idParams.shape.id;
const hotelQuery = z.object({ query: z.object({ hotel: id }).strict() });
const policyBody = z.object({ version: z.number().int().min(0), maxAdvanceDays: z.number().int().min(0).max(730), maxStayNights: z.number().int().min(1).max(365), cancellationDays: z.number().int().min(0).max(365), taxBps: z.number().int().min(0).max(10000), allowSameDay: z.boolean(), checkInHour: z.number().int().min(0).max(23), checkOutHour: z.number().int().min(0).max(23), weekendRateBps: z.number().int().min(1000).max(30000) }).strict();
const validWindow = (v) => v.allowSameDay || v.maxAdvanceDays > 0;
const manage = authorize('admin', 'manager');
router.use(protect);
router.get('/monitoring', authorize('admin'), (_req, res) => res.json({ success: true, metrics: metrics() }));
router.get('/policies', validate(hotelQuery), asyncHandler(async (req, res) => {
  await hotelAccess(req, req.query.hotel, null, false);
  const saved = await HotelPolicy.findOne({ hotel: req.query.hotel });
  const overridden = saved && saved.isOverride !== false;
  const values = overridden ? Object.fromEntries(Object.keys(policyDefaults).map((key) => [key, saved[key]])) : await policyFor();
  res.json({ success: true, source: overridden ? 'hotel' : 'global', policy: { ...values, version: saved?.version || 0 } });
}));
router.put('/policies', manage, validate(z.object({ body: policyBody.extend({ hotel: id }).refine(validWindow, 'Allow at least one arrival date') })), asyncHandler(async (req, res) => {
  let policy;
  await transact(async (session) => {
    await hotelAccess(req, req.body.hotel, session, true, true);
    policy = await HotelPolicy.findOne({ hotel: req.body.hotel }).session(session);
    if ((policy?.version || 0) !== req.body.version) throw new ApiError(409, 'Policy changed; refresh before saving');
    const before = await policyFor(req.body.hotel, session);
    if (!policy) policy = new HotelPolicy({ hotel: req.body.hotel });
    policy.set({ ...req.body, isOverride: true, version: req.body.version + 1 });
    await policy.save({ session });
    await audit(req, 'policy.update', req.body.hotel, { before, after: await policyFor(req.body.hotel, session) }, session);
  });
  res.json({ success: true, policy });
}));
router.post('/policies/reset', manage, validate(z.object({ body: z.object({ hotel: id, version: z.number().int().min(0) }).strict() })), asyncHandler(async (req, res) => {
  await transact(async (session) => {
    await hotelAccess(req, req.body.hotel, session, true, true);
    const before = await policyFor(req.body.hotel, session);
    const policy = await HotelPolicy.findOneAndUpdate({ hotel: req.body.hotel, version: req.body.version, isOverride: true }, { $set: { isOverride: false }, $inc: { version: 1 } }, { new: true, session });
    if (!policy) throw new ApiError(409, 'Policy changed or already inherits defaults; refresh before saving');
    await audit(req, 'policy.reset', req.body.hotel, { before, after: await policyFor(null, session) }, session);
  });
  res.json({ success: true });
}));
router.get('/settings', authorize('admin'), asyncHandler(async (_req, res) => {
  const saved = await SystemSetting.findOne({ key: 'policies' });
  res.json({ success: true, policy: { ...Object.fromEntries(Object.keys(policyDefaults).map((key) => [key, saved?.[key] ?? policyDefaults[key]])), version: saved?.version || 0 } });
}));
router.put('/settings', authorize('admin'), validate(z.object({ body: policyBody.refine(validWindow, 'Allow at least one arrival date') })), asyncHandler(async (req, res) => {
  let policy;
  await transact(async (session) => {
    const before = await policyFor(null, session);
    policy = await SystemSetting.findOneAndUpdate({ key: 'policies', version: req.body.version }, { $set: { ...req.body, version: req.body.version + 1 } }, { new: true, session });
    if (!policy) {
      if (req.body.version !== 0 || await SystemSetting.exists({ key: 'policies' }).session(session)) throw new ApiError(409, 'Settings changed; refresh before saving');
      [policy] = await SystemSetting.create([{ ...req.body, version: 1 }], { session });
    }
    await audit(req, 'settings.update', policy._id, { before, after: await policyFor(null, session) }, session);
  });
  res.json({ success: true, policy });
}));
router.get('/notifications', validate(z.object({ query: paginationQuery.extend({ hotel: id, unread: z.enum(['true', 'false']).default('false') }).strict() })), asyncHandler(async (req, res) => {
  await hotelAccess(req, req.query.hotel, null, false);
  await paged(Notification, { recipient: req.user._id, hotel: req.query.hotel, ...(req.query.unread === 'true' ? { readAt: null } : {}) }, req, res, 'notifications');
}));
router.post('/notifications/:id/read', validate(z.object({ params: idParams, body: z.object({}).strict() })), asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  await hotelAccess(req, notification.hotel, null, false);
  await Notification.updateOne({ _id: notification._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true });
}));
router.get('/reports', manage, validate(z.object({ query: z.object({ hotel: id, from: date, to: date }).strict().refine((v) => v.from < v.to && (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 366, 'Choose a period of 1–366 days; end date is exclusive') })), asyncHandler(async (req, res) => {
  const { hotel, from, to } = req.query;
  await hotelAccess(req, hotel, null, false);
  const hotelId = new mongoose.Types.ObjectId(hotel);
  const period = { $gte: new Date(`${from}T00:00:00Z`), $lt: new Date(`${to}T00:00:00Z`) };
  let report;
  await transact(async (session) => {
  const reservations = await Reservation.aggregate([{ $match: { hotel: hotelId, checkIn: { $gte: from, $lt: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).session(session);
  const payments = await Payment.aggregate([{ $match: { hotel: hotelId, createdAt: period } }, { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]).session(session);
  const invoices = await Invoice.aggregate([{ $match: { hotel: hotelId, status: 'issued', issuedAt: period } }, { $group: { _id: '$currency', subtotal: { $sum: '$subtotal' }, discount: { $sum: '$discount' }, tax: { $sum: '$tax' }, total: { $sum: '$total' }, count: { $sum: 1 } } }]).session(session);
  const feedback = await GuestFeedback.aggregate([{ $match: { hotel: hotelId, createdAt: period } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]).session(session);
  report = { from, to, reservations, payments, invoices, feedback: feedback[0] || { count: 0, average: null }, ...await operationalReport(hotelId, from, to, session) };
  });
  res.json({ success: true, report });
}));
export default router;
