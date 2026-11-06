import mongoose from 'mongoose';
import Service from '../models/Service.js';
import ServiceRequest from '../models/ServiceRequest.js';
import BillingCharge from '../models/BillingCharge.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import GuestFeedback from '../models/GuestFeedback.js';
import AuditEvent from '../models/AuditEvent.js';
import ApiError from '../utils/ApiError.js';
import escapeRegex from '../utils/escapeRegex.js';
import { audit } from '../utils/audit.js';
import { queueEmail } from '../utils/email.js';
import { hotelAccess, transact, paged } from '../services/hotelOperations.js';
import { financialStay, billFor, checkBillVersion, advanceStay, recordPayment, invoiceText } from '../services/billing.js';
import { STAFF_ROLES } from '../config/roles.js';

const desk = (req) => ['admin', 'manager', 'receptionist'].includes(req.user.role);
async function chargeLimit(stay, session) {
  if (await BillingCharge.countDocuments({ stay: stay._id }).session(session) >= 1000) throw new ApiError(409, 'This account has reached its 1,000-charge limit');
}
export async function listServices(req, res) {
  await hotelAccess(req, req.query.hotel);
  await paged(Service, { hotel: req.query.hotel, ...(!['admin', 'manager'].includes(req.user.role) ? { isActive: true } : {}), ...(req.query.search ? { name: { $regex: escapeRegex(req.query.search), $options: 'i' } } : {}) }, req, res, 'services');
}
export async function saveService(req, res) {
  let service;
  await transact(async (session) => {
    service = req.params.id ? await Service.findById(req.params.id).session(session) : null;
    if (req.params.id && !service) throw new ApiError(404, 'Service not found');
    await hotelAccess(req, service?.hotel || req.body.hotel, session, true, true);
    if (service) { service.set(req.body); await service.save({ session }); }
    else [service] = await Service.create([req.body], { session });
    await audit(req, req.params.id ? 'service.update' : 'service.create', service._id, { unitPrice: service.unitPrice, currency: service.currency, isActive: service.isActive }, session);
  });
  res.status(req.params.id ? 200 : 201).json({ success: true, service });
}
export async function serviceAssignees(req, res) {
  await hotelAccess(req, req.query.hotel);
  const { page, limit, search } = req.query;
  const filter = { hotel: req.query.hotel, role: { $in: STAFF_ROLES }, isActive: true, ...(search ? { name: { $regex: escapeRegex(search), $options: 'i' } } : {}) };
  const [staff, total] = await Promise.all([User.find(filter).select('name role').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
  res.json({ success: true, staff, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function createRequest(req, res) {
  let request;
  await transact(async (session) => {
    const stay = await financialStay(req, req.body.stay, session, true);
    const service = await Service.findOne({ _id: req.body.service, hotel: stay.hotel, isActive: true }).session(session);
    if (!service) throw new ApiError(404, 'Active service not found at this hotel');
    const bill = await billFor(stay, session);
    if (service.currency !== bill.currency) throw new ApiError(409, 'Service currency must match the stay currency');
    [request] = await ServiceRequest.create([{ hotel: stay.hotel, stay: stay._id, owner: stay.owner, service: service._id, requestedBy: req.user._id, quantity: req.body.quantity, notes: req.body.notes, snapshot: { name: service.name, unitPrice: service.unitPrice, currency: service.currency } }], { session });
    await advanceStay(stay, session);
    await audit(req, 'service_request.create', request._id, { stay: String(stay._id), quantity: request.quantity }, session);
  });
  res.status(201).json({ success: true, request });
}
export async function listRequests(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  const filter = { hotel: req.query.hotel, ...(req.query.status ? { status: req.query.status } : {}), ...(req.query.search ? { 'snapshot.name': { $regex: escapeRegex(req.query.search), $options: 'i' } } : {}) };
  if (!desk(req)) Object.assign(filter, req.user.role === 'user' ? { owner: req.user._id } : { assignedTo: req.user._id });
  await paged(ServiceRequest, filter, req, res, 'requests', [{ path: 'assignedTo', select: 'name role' }, { path: 'stay', select: 'room status', populate: { path: 'room', select: 'number' } }]);
}
async function requestFor(req, session) {
  const request = await ServiceRequest.findById(req.params.id).session(session || null);
  if (!request) throw new ApiError(404, 'Service request not found');
  await hotelAccess(req, request.hotel, session, false, !!session);
  if (!desk(req) && (req.user.role === 'user' ? String(request.owner) !== String(req.user._id) : String(request.assignedTo) !== String(req.user._id))) throw new ApiError(404, 'Service request not found');
  return request;
}
export async function assignRequest(req, res) {
  let request;
  await transact(async (session) => {
    request = await requestFor(req, session); checkBillVersion(request, req.body.version);
    if (!['pending', 'in_progress'].includes(request.status)) throw new ApiError(409, 'Completed or cancelled requests cannot be assigned');
    if (req.body.assignedTo && !await User.exists({ _id: req.body.assignedTo, hotel: request.hotel, isActive: true, role: { $in: STAFF_ROLES } }).session(session)) throw new ApiError(400, 'Select active staff from this hotel');
    request.assignedTo = req.body.assignedTo; request.version += 1; await request.save({ session });
    await audit(req, 'service_request.assign', request._id, { assignedTo: req.body.assignedTo }, session);
  });
  res.json({ success: true, request });
}
export async function actRequest(req, res) {
  let request;
  await transact(async (session) => {
    request = await requestFor(req, session); checkBillVersion(request, req.body.version);
    const stay = await financialStay(req, request.stay, session, true);
    const { action, notes } = req.body;
    if (req.user.role === 'user' && !(action === 'cancel' && request.status === 'pending')) throw new ApiError(403, 'Guests may cancel only pending requests');
    if (action === 'start') {
      if (request.status !== 'pending') throw new ApiError(409, 'Only pending requests can start');
      request.status = 'in_progress';
    } else if (action === 'complete') {
      if (request.status !== 'in_progress') throw new ApiError(409, 'Start the service before completing it');
      await chargeLimit(stay, session);
      await BillingCharge.create([{ hotel: stay.hotel, stay: stay._id, serviceRequest: request._id, description: request.snapshot.name, quantity: request.quantity, unitAmount: request.snapshot.unitPrice, total: request.quantity * request.snapshot.unitPrice, currency: request.snapshot.currency, createdBy: req.user._id }], { session });
      request.status = 'completed'; request.completedAt = new Date();
      await audit(req, 'billing.service_charge', stay._id, { request: String(request._id), total: request.quantity * request.snapshot.unitPrice }, session);
    } else {
      if (!['pending', 'in_progress'].includes(request.status)) throw new ApiError(409, 'Request is already completed or cancelled');
      request.status = 'cancelled';
    }
    request.completionNotes = notes; request.version += 1; await request.save({ session });
    await advanceStay(stay, session);
    await audit(req, `service_request.${action}`, request._id, { reason: notes }, session);
  });
  res.json({ success: true, request });
}
export async function requestHistory(req, res) {
  await requestFor(req);
  await paged(AuditEvent, { target: req.params.id, action: /^service_request\./ }, req, res, 'events');
}
export async function getBill(req, res) {
  const stay = await financialStay(req, req.params.id);
  res.json({ success: true, bill: await billFor(stay), stay });
}
export async function addCharge(req, res) {
  let charge;
  await transact(async (session) => {
    const stay = await financialStay(req, req.params.id, session, true); checkBillVersion(stay, req.body.version);
    const bill = await billFor(stay, session); await chargeLimit(stay, session);
    [charge] = await BillingCharge.create([{ hotel: stay.hotel, stay: stay._id, description: req.body.description, quantity: req.body.quantity, unitAmount: req.body.unitAmount, total: req.body.quantity * req.body.unitAmount, currency: bill.currency, createdBy: req.user._id }], { session });
    await advanceStay(stay, session);
    await audit(req, 'billing.charge', stay._id, { charge: String(charge._id), description: charge.description, total: charge.total }, session);
  });
  res.status(201).json({ success: true, charge });
}
export async function voidCharge(req, res) {
  await transact(async (session) => {
    const stay = await financialStay(req, req.params.id, session, true); checkBillVersion(stay, req.body.version);
    const charge = await BillingCharge.findOne({ _id: req.params.chargeId, stay: stay._id, status: 'posted' }).session(session);
    if (!charge) throw new ApiError(404, 'Posted charge not found');
    charge.set({ status: 'voided', voidReason: req.body.reason, voidedBy: req.user._id, voidedAt: new Date() }); await charge.save({ session });
    const bill = await billFor(stay, session);
    if (bill.balance < 0) throw new ApiError(409, 'This adjustment would require a refund; it cannot be applied here');
    await advanceStay(stay, session);
    await audit(req, 'billing.void_charge', stay._id, { charge: String(charge._id), reason: req.body.reason }, session);
  });
  res.json({ success: true });
}
export async function configureBill(req, res) {
  await transact(async (session) => {
    const stay = await financialStay(req, req.params.id, session, true); checkBillVersion(stay, req.body.version);
    let invoice = await Invoice.findOne({ stay: stay._id }).session(session);
    if (!invoice) invoice = new Invoice({ hotel: stay.hotel, stay: stay._id });
    if (invoice.status === 'issued') throw new ApiError(409, 'Issued invoices are immutable');
    invoice.set({ taxBps: req.body.taxBps, discount: req.body.discount, discountReason: req.body.discountReason }); await invoice.save({ session });
    if ((await billFor(stay, session)).balance < 0) throw new ApiError(409, 'This adjustment would require a refund; it cannot be applied here');
    await advanceStay(stay, session);
    await audit(req, 'billing.adjustment', stay._id, { taxBps: req.body.taxBps, discount: req.body.discount, reason: req.body.discountReason }, session);
  });
  res.json({ success: true });
}
export async function addPayment(req, res) {
  let payment;
  await transact(async (session) => {
    const stay = await financialStay(req, req.params.id, session, true); checkBillVersion(stay, req.body.version);
    payment = await recordPayment(req, stay, req.body, await billFor(stay, session), session);
    await advanceStay(stay, session);
  });
  res.status(201).json({ success: true, payment });
}
export async function emailInvoice(req, res) {
  await transact(async (session) => {
    const stay = await financialStay(req, req.params.id, session);
    const invoice = await Invoice.findOne({ stay: stay._id, status: 'issued' }).session(session);
    if (!invoice) throw new ApiError(409, 'Final invoice is issued at checkout');
    if (invoice.lastEmailedAt && Date.now() - invoice.lastEmailedAt.valueOf() < 60000) throw new ApiError(429, 'Wait one minute before requesting another invoice email');
    invoice.lastEmailedAt = new Date(); await invoice.save({ session });
    await queueEmail(invoice.guest.email, `LuxuryStay invoice ${invoice.number}`, invoiceText(invoice), undefined, session);
    await audit(req, 'billing.email', stay._id, { number: invoice.number }, session);
  });
  res.json({ success: true, message: 'Invoice queued for its recorded guest email' });
}
export async function billingHistory(req, res) {
  await financialStay(req, req.params.id);
  await paged(AuditEvent, { target: req.params.id, action: /^billing\./ }, req, res, 'events');
}
export async function createFeedback(req, res) {
  let feedback;
  await transact(async (session) => {
    const stay = await financialStay(req, req.body.stay, session);
    if (stay.status !== 'completed') throw new ApiError(409, 'Feedback is accepted after checkout');
    [feedback] = await GuestFeedback.create([{ hotel: stay.hotel, stay: stay._id, guest: req.user._id, rating: req.body.rating, comment: req.body.comment }], { session });
    await audit(req, 'feedback.create', feedback._id, { rating: feedback.rating, hotel: String(stay.hotel) }, session);
  });
  res.status(201).json({ success: true, feedback });
}
export async function listFeedback(req, res) {
  await hotelAccess(req, req.query.hotel, null, false);
  const filter = { hotel: new mongoose.Types.ObjectId(req.query.hotel), ...(req.user.role === 'user' ? { guest: req.user._id } : {}), ...(req.query.rating ? { rating: req.query.rating } : {}), ...(req.query.search ? { comment: { $regex: escapeRegex(req.query.search), $options: 'i' } } : {}) };
  const { page, limit } = req.query;
  const [feedback, summary] = await Promise.all([GuestFeedback.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('guest', 'name'), GuestFeedback.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$rating' } } }])]);
  const total = summary[0]?.total || 0;
  res.json({ success: true, feedback, summary: { total, average: summary[0]?.average || 0 }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
