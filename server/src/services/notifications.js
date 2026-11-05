import Notification from '../models/Notification.js';
import User from '../models/User.js';
export async function notifyHotel(hotel, module, target, message, session, owner) {
  const roles = module === 'housekeeping' ? ['manager', 'receptionist', 'housekeeping'] : module === 'maintenance' ? ['manager', 'receptionist', 'maintenance'] : ['manager', 'receptionist'];
  const recipients = await User.find({ isActive: true, $or: [{ role: 'admin' }, { hotel, role: { $in: roles } }, ...(owner ? [{ _id: owner }] : [])] }).select('_id').session(session || null);
  if (recipients.length) await Notification.insertMany(recipients.map(({ _id }) => ({ hotel, recipient: _id, module, target, message })), { session, ordered: true });
}
