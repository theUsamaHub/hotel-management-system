import mongoose from 'mongoose';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import HotelPolicy from '../models/HotelPolicy.js';
import StayKey from '../models/StayKey.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import { audit } from '../utils/audit.js';
import * as hotels from '../controllers/hotel.js';
import * as rooms from '../controllers/hms.js';
import * as ops from '../controllers/operations.js';
import * as finance from '../controllers/finance.js';

const CODE = 'LS-DEMO';
const roles = ['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'user'];
const names = ['Demo Administrator', 'Amina Manager', 'Bilal Reception', 'Sara Housekeeping', 'Omar Maintenance', 'Noor Guest'];
export const demoEmails = roles.map((role) => `demo.${role}@luxurystay.example`);
const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
async function invoke(handler, user, body = {}, params = {}) {
  let result;
  const res = { status() { return this; }, json(value) { result = value; } };
  await handler({ user, body, params, query: {} }, res);
  return result;
}

// Uses the same transactional domain controllers as the application, preserving
// invoice, inventory, notification and audit invariants. Never clears collections.
export async function seedHotelDemo(password) {
  if (!password || password.length < 12) throw new Error('Demo password must have at least 12 characters');
  const runs = mongoose.connection.collection('demo_seed_runs');
  const previous = await runs.findOne({ _id: CODE });
  if (previous?.status === 'complete') return { skipped: true, hotel: previous.hotel, emails: demoEmails };
  if (previous) throw new Error('An incomplete demo run exists; inspect it before attempting another run');
  if (await Hotel.exists({ code: CODE }) || await User.exists({ email: { $in: demoEmails } })) {
    throw new Error('Demo identifiers already exist; existing data was not changed');
  }
  // Unique _id prevents concurrent seed processes from both creating records.
  await runs.insertOne({ _id: CODE, status: 'running', startedAt: new Date() });
  let stage = 'accounts';
  try {
    const admin = await User.create({ name: names[0], email: demoEmails[0], password, role: 'admin', emailVerified: true });
    await audit({ user: admin }, 'demo.seed_started', CODE);
    const { hotel } = await invoke(hotels.createHotel, admin, { name: 'LuxuryStay Demo House', code: CODE, address: 'Demonstration property - not a real accommodation listing', city: 'Karachi', country: 'Pakistan', email: 'demo.hotel@luxurystay.example', phone: '', isActive: true });
    const users = { admin };
    for (let i = 1; i < roles.length; i++) {
      const role = roles[i];
      if (role === 'user') {
        users[role] = await User.create({ name: names[i], email: demoEmails[i], password, role, emailVerified: true });
        await audit({ user: users[role] }, 'auth.register', users[role]._id);
      } else {
        users[role] = (await invoke(hotels.createStaff, admin, { name: names[i], email: demoEmails[i], password, role, hotel: hotel._id, isActive: true, phone: '', jobTitle: role })).user;
      }
    }
    const { manager, receptionist, housekeeping, maintenance, user: guest } = users;
    await HotelPolicy.create({ hotel: hotel._id, checkInHour: 0, checkOutHour: 0, allowSameDay: true, taxBps: 0 });
    await audit({ user: manager }, 'policy.update', hotel._id, { demo: true, checkInHour: 0, taxBps: 0 });
    stage = 'inventory';
    const inventory = [];
    for (const [index, name, capacity, rate] of [[1, 'Classic double', 2, 1250000], [2, 'Terrace suite', 2, 1950000], [3, 'Family room', 4, 2400000]]) {
      const { roomType } = await invoke(rooms.saveType, manager, { hotel: hotel._id, name, capacity, rate, currency: 'PKR', description: 'Demonstration inventory for learning the booking workflow.', isActive: true });
      for (let n = 1; n <= 3; n++) {
        const { room } = await invoke(rooms.saveRoom, manager, { hotel: hotel._id, roomType: roomType._id, number: `${index}0${n}`, floor: String(index), isActive: true });
        inventory.push(room);
      }
    }
    const services = [];
    for (const [name, unitPrice, description] of [['Breakfast tray', 180000, 'Demo breakfast service, per person.'], ['Laundry bag', 90000, 'Demo laundry collection, per bag.'], ['Airport transfer', 450000, 'Demo transfer request, per vehicle.']]) {
      services.push((await invoke(finance.saveService, manager, { hotel: hotel._id, name, unitPrice, currency: 'PKR', description, isActive: true })).service);
    }
    const { guest: profile } = await invoke(rooms.saveGuest, guest, { hotel: hotel._id, name: guest.name, email: guest.email, phone: '0000000000', preferences: 'Demo guest profile; quiet room preferred.' });
    await invoke(rooms.saveGuest, receptionist, { hotel: hotel._id, name: 'Demo Walk-in Guest', email: 'walkin@luxurystay.example', phone: '0000000000', preferences: 'Example unlinked walk-in profile.' });
    const booking = async (room, offset = 0) => (await invoke(rooms.createBooking, guest, { hotel: hotel._id, guest: profile._id, room: room._id, checkIn: date(offset), checkOut: date(offset + 2), occupants: 2, notes: 'DEMO - training reservation' })).reservation;
    const confirm = async (record) => (await invoke(rooms.updateBooking, receptionist, { version: record.version }, { id: record._id, action: 'confirm' })).reservation;
    const arrive = async (record, label) => (await invoke(ops.checkIn, receptionist, { version: record.version, guestVerified: true, verificationNote: 'Demo arrival verified; no real identity documents.', keys: [label] }, { id: record._id })).stay;
    stage = 'reservations and stays';
    await booking(inventory[0], 4);
    await confirm(await booking(inventory[1], 5));
    const active = await arrive(await confirm(await booking(inventory[3])), 'DEMO-201-A');
    let request = (await invoke(finance.createRequest, guest, { stay: active._id, service: services[0]._id, quantity: 2, notes: 'Demo breakfast request' })).request;
    request = (await invoke(finance.assignRequest, receptionist, { version: request.version, assignedTo: housekeeping._id }, { id: request._id })).request;
    for (const action of ['start', 'complete']) request = (await invoke(finance.actRequest, housekeeping, { version: request.version, action, notes: 'Demo service ' + action }, { id: request._id })).request;
    await invoke(finance.createRequest, guest, { stay: active._id, service: services[1]._id, quantity: 1, notes: 'Pending demo request for practice' });
    let bill = (await invoke(finance.getBill, receptionist, {}, { id: active._id })).bill;
    await invoke(finance.addPayment, receptionist, { version: bill.version, amount: 1000000, method: 'cash', reference: 'DEMO-DEPOSIT-201' }, { id: active._id });
    await invoke(ops.createMaintenance, guest, { hotel: hotel._id, room: inventory[3]._id, title: 'Demo bedside lamp', description: 'Example guest-reported issue.', priority: 'normal', blocksRoom: false });
    stage = 'completed stay and invoice';
    const completed = await arrive(await confirm(await booking(inventory[4])), 'DEMO-202-A');
    bill = (await invoke(finance.getBill, receptionist, {}, { id: completed._id })).bill;
    const key = await StayKey.findOne({ stay: completed._id });
    await invoke(ops.closeKey, receptionist, { version: bill.version, status: 'returned', note: 'Demo key returned' }, { id: completed._id, keyId: key._id });
    bill = (await invoke(finance.getBill, receptionist, {}, { id: completed._id })).bill;
    await invoke(ops.checkout, receptionist, { version: bill.version, billingReviewed: true, amount: bill.balance, currency: 'PKR', method: 'cash', reference: 'DEMO-FINAL-202' }, { id: completed._id });
    let task = await HousekeepingTask.findOne({ room: inventory[4]._id, open: true });
    task = (await invoke(ops.editHousekeeping, receptionist, { version: task.version, assignedTo: housekeeping._id, scheduledFor: new Date(), notes: 'Demo departure cleaning' }, { id: task._id })).task;
    for (const action of ['start', 'complete']) task = (await invoke(ops.actHousekeeping, housekeeping, { version: task.version, action, notes: 'Demo cleaning ' + action }, { id: task._id })).task;
    await invoke(finance.createFeedback, guest, { stay: completed._id, rating: 5, comment: 'Demonstration review, not a real customer testimonial.' });
    stage = 'work queues';
    await invoke(ops.createHousekeeping, receptionist, { hotel: hotel._id, room: inventory[6]._id, assignedTo: housekeeping._id, scheduledFor: new Date(), notes: 'Demo scheduled room refresh' });
    const repair = (await invoke(ops.createMaintenance, manager, { hotel: hotel._id, room: inventory[7]._id, assignedTo: maintenance._id, title: 'Demo air-conditioning inspection', description: 'Training repair; room blocked until repaired and cleaned.', priority: 'high', blocksRoom: true })).request;
    await invoke(ops.actMaintenance, maintenance, { version: repair.version, action: 'start', notes: 'Demo inspection started' }, { id: repair._id });
    await audit({ user: admin }, 'demo.seed_completed', hotel._id, { rooms: inventory.length, accounts: roles.length });
    await runs.updateOne({ _id: CODE }, { $set: { status: 'complete', hotel: String(hotel._id), completedAt: new Date() } });
    return { skipped: false, hotel: String(hotel._id), emails: demoEmails };
  } catch (error) {
    await runs.updateOne({ _id: CODE }, { $set: { status: 'failed', stage } });
    throw error;
  }
}
