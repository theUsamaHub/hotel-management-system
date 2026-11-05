import Stay from '../models/Stay.js';
import Reservation from '../models/Reservation.js';
import Hotel from '../models/Hotel.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import BillingCharge from '../models/BillingCharge.js';
import ServiceRequest from '../models/ServiceRequest.js';
import ApiError from '../utils/ApiError.js';
import { hotelAccess } from './hotelOperations.js';
import { audit } from '../utils/audit.js';
import { queueEmail } from '../utils/email.js';

export function roomSettlement(booking) {
  const extraNights = Math.max(0, Math.floor((Date.now() - Date.parse(booking.checkOut) - (booking.policy?.checkOutHour || 0) * 3600000) / 86400000));
  return { roomTotal: booking.quote.total + extraNights * booking.quote.rate, extraNights, currency: booking.quote.currency };
}
export async function financialStay(req, id, session, active = false) {
  const stay = await Stay.findOne({ _id: id, ...(req.user.role === 'user' ? { owner: req.user._id } : {}) }).session(session || null);
  if (!stay) throw new ApiError(404, 'Stay not found');
  await hotelAccess(req, stay.hotel, session, false, !!session);
  if (active && stay.status !== 'active') throw new ApiError(409, 'Completed stay accounts are immutable');
  return stay;
}
export const checkBillVersion = (stay, version) => { if (stay.version !== version) throw new ApiError(409, 'Stay account changed; refresh before trying again'); };
export async function advanceStay(stay, session) { stay.version += 1; await stay.save({ session }); }
export async function billFor(stay, session) {
  const invoice = await Invoice.findOne({ stay: stay._id }).session(session || null);
  const payments = await Payment.find({ stay: stay._id }).sort({ createdAt: 1 }).session(session || null);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const booking = await Reservation.findById(stay.reservation).session(session || null);
  if (invoice?.status === 'issued') return { ...invoice.toObject(), paid, balance: invoice.total - paid, payments, version: stay.version };
  const charges = await BillingCharge.find({ stay: stay._id }).sort({ createdAt: 1 }).session(session || null);
  const room = stay.status === 'completed' ? { roomTotal: stay.settlement.roomTotal, extraNights: stay.settlement.extraNights || 0, currency: stay.settlement.currency } : roomSettlement(booking);
  const lines = [{ description: `Room ${booking.quote.roomNumber} · ${booking.checkIn} to ${booking.checkOut}`, quantity: booking.quote.nights, unitAmount: booking.quote.rate, total: booking.quote.total }];
  if (room.extraNights) lines.push({ description: 'Additional overdue nights', quantity: room.extraNights, unitAmount: booking.quote.rate, total: room.extraNights * booking.quote.rate });
  for (const charge of charges.filter((charge) => charge.status === 'posted')) lines.push({ description: charge.description, quantity: charge.quantity, unitAmount: charge.unitAmount, total: charge.total });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discount = invoice?.discount || 0;
  if (!Number.isSafeInteger(subtotal) || discount > subtotal) throw new ApiError(409, 'Charges do not support the configured discount or exceed the account limit');
  const taxBps = invoice?.taxBps ?? booking.policy?.taxBps ?? 0;
  const tax = Number((BigInt(subtotal - discount) * BigInt(taxBps) + 5000n) / 10000n);
  const total = subtotal - discount + tax;
  if (!Number.isSafeInteger(total)) throw new ApiError(409, 'Account total exceeds the supported limit');
  const property = await Hotel.findById(stay.hotel).select('name address city country email phone').session(session || null);
  const legacy = stay.status === 'completed' && !invoice;
  const recordedPaid = legacy ? stay.settlement.amount : paid;
  return { _id: invoice?._id, number: invoice?.number || null, status: legacy ? 'legacy_settlement' : 'draft', ...room, lines, charges, subtotal, discount, discountReason: invoice?.discountReason || '', taxBps, tax, total, paid: recordedPaid, balance: total - recordedPaid, payments, guest: booking.contact.toObject(), property: property.toObject(), bookingReference: booking.reference, version: stay.version };
}
export async function recordPayment(req, stay, data, bill, session) {
  if (data.amount <= 0 || data.amount > bill.balance) throw new ApiError(409, 'Payment must be positive and no greater than the outstanding balance');
  const [payment] = await Payment.create([{ hotel: stay.hotel, stay: stay._id, amount: data.amount, currency: bill.currency, method: data.method, reference: data.reference, recordedBy: req.user._id }], { session });
  await audit(req, 'billing.payment', stay._id, { amount: payment.amount, currency: payment.currency, method: payment.method, reference: payment.reference }, session);
  return payment;
}
export function invoiceText(invoice) {
  return `LuxuryStay invoice ${invoice.number}\n${invoice.property.name}\nGuest: ${invoice.guest.name}\nBooking: ${invoice.bookingReference}\n${invoice.lines.map((line) => `${line.description}: ${line.quantity} x ${(line.unitAmount / 100).toFixed(2)} = ${(line.total / 100).toFixed(2)}`).join('\n')}\nSubtotal: ${(invoice.subtotal / 100).toFixed(2)}\nDiscount: ${(invoice.discount / 100).toFixed(2)}\nTax (${invoice.taxBps / 100}%): ${(invoice.tax / 100).toFixed(2)}\nTotal: ${(invoice.total / 100).toFixed(2)} ${invoice.currency}\nPaid in full. Payments were recorded by hotel staff; no online payment was processed by this app.`;
}
export async function finalizeCheckout(req, stay, data, session) {
  if (await ServiceRequest.exists({ stay: stay._id, status: { $in: ['pending', 'in_progress'] } }).session(session)) throw new ApiError(409, 'Complete or cancel outstanding service requests before checkout');
  const bill = await billFor(stay, session);
  if (data.amount !== bill.balance || data.currency !== bill.currency) throw new ApiError(409, 'Settlement must match the current outstanding bill and currency');
  if (data.amount > 0) await recordPayment(req, stay, data, bill, session);
  let invoice = await Invoice.findOne({ stay: stay._id }).session(session);
  if (!invoice) invoice = new Invoice({ hotel: stay.hotel, stay: stay._id });
  if (invoice.status === 'issued') throw new ApiError(409, 'Invoice was already issued');
  invoice.set({ status: 'issued', currency: bill.currency, roomTotal: bill.roomTotal, extraNights: bill.extraNights, lines: bill.lines, subtotal: bill.subtotal, discount: bill.discount, discountReason: bill.discountReason, taxBps: bill.taxBps, tax: bill.tax, total: bill.total, guest: bill.guest, property: bill.property, bookingReference: bill.bookingReference, issuedAt: new Date(), lastEmailedAt: new Date() });
  await invoice.save({ session });
  await queueEmail(invoice.guest.email, `LuxuryStay invoice ${invoice.number}`, invoiceText(invoice), undefined, session);
  await audit(req, 'billing.invoice_issued', stay._id, { number: invoice.number, total: invoice.total, currency: invoice.currency }, session);
  return { ...bill, invoice, amount: bill.total };
}
