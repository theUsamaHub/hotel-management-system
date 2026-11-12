import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BedDouble,
  ClipboardList,
  Sparkles,
  Wrench,
  Users,
  ReceiptText,
  Bell,
  Coffee,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth.js';

const tasks = {
  manager: [
    ['reservations', 'Reservations', 'Review bookings, arrivals and changes.', ClipboardList],
    ['rooms', 'Room inventory', 'Keep rooms and availability up to date.', BedDouble],
    ['housekeeping', 'Housekeeping', 'Coordinate room cleaning and readiness.', Sparkles],
    ['maintenance', 'Maintenance', 'Review reported issues and repair progress.', Wrench],
    ['billing', 'Billing & invoices', 'Review guest charges, receipts and invoices.', ReceiptText],
    ['reports', 'Hotel reports', 'Review the performance of your property.', ClipboardList],
  ],
  receptionist: [
    ['search', 'Find rooms', 'Check dates and make a reservation.', BedDouble],
    ['guests', 'Guest profiles', 'Maintain contact details for each guest.', Users],
    ['reservations', 'Reservations', 'Confirm and manage upcoming bookings.', ClipboardList],
    ['stays', 'Guest stays', 'Manage arrivals, departures and room keys.', BedDouble],
    ['billing', 'Billing & invoices', 'Record receipts and prepare guest invoices.', ReceiptText],
    ['services', 'Guest services', 'Coordinate requests during a stay.', Coffee],
  ],
  housekeeping: [
    [
      'housekeeping',
      'Cleaning tasks',
      'Review assignments and update cleaning progress.',
      Sparkles,
    ],
    ['rooms', 'Room readiness', 'Check room status before the next arrival.', BedDouble],
    ['maintenance', 'Maintenance issues', 'Report issues that need attention.', Wrench],
    ['notifications', 'Notifications', 'Stay up to date with hotel activity.', Bell],
  ],
  maintenance: [
    ['maintenance', 'Repair requests', 'Review issues and update repair progress.', Wrench],
    ['rooms', 'Room status', 'See which rooms are affected by maintenance.', BedDouble],
    ['notifications', 'Notifications', 'Keep track of hotel updates.', Bell],
    ['policies', 'Hotel policies', 'Check your property policies and guidance.', ClipboardList],
  ],
};

function StaffDashboard() {
  const { user } = useAuth();
  const items = tasks[user.role] || [];
  const roleTitle = {
    manager: 'Management',
    receptionist: 'Front desk',
    housekeeping: 'Housekeeping',
    maintenance: 'Maintenance',
  }[user.role];
  const first = items[0]?.[0] || 'rooms';
  return (
    <>
      <section className="role-welcome card">
        <div>
          <p className="eyebrow">Luxury Star Hotel / {roleTitle}</p>
          <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
          <p>Everything you need to keep your hotel running smoothly.</p>
          <Link className="button" to={`/user/operations?tab=${first}`}>
            Open your workspace <ArrowUpRight size={16} />
          </Link>
        </div>
        <span className="role-welcome-icon" aria-hidden="true">
          <BedDouble size={42} strokeWidth={1.3} />
        </span>
      </section>
      <div className="section-label">
        <h2>Your daily workspace</h2>
        <span className="badge">{roleTitle}</span>
      </div>
      <div className="role-task-grid">
        {items.map(([tab, title, text, Icon]) => (
          <Link className="card role-task-card" key={tab} to={`/user/operations?tab=${tab}`}>
            <span className="role-task-icon">
              <Icon size={21} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="role-task-action">
              Open workspace <ArrowUpRight size={17} />
            </span>
          </Link>
        ))}
      </div>
      <section className="card role-support">
        <div>
          <h2>Stay connected</h2>
          <p>Property details, shared resources and your account.</p>
        </div>
        <div className="role-support-links">
          <Link className="button secondary" to="/user/hotels">
            Hotel details
          </Link>
          {user.role === 'manager' && (
            <Link className="button secondary" to="/user/staff">
              Hotel staff
            </Link>
          )}
          <Link className="button secondary" to="/user/media">
            Shared media
          </Link>
          <Link className="button secondary" to="/user/profile">
            Account settings
          </Link>
        </div>
      </section>
    </>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();
  if (user.role !== 'user') return <StaffDashboard />;
  return (
    <>
      <section className="guest-account-hero card">
        <p className="eyebrow">Your Luxury Star Hotel</p>
        <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
        <p>Your next stay, and every detail that comes with it.</p>
        <Link className="button" to="/user/operations">
          Find a room <ArrowUpRight size={16} />
        </Link>
      </section>
      <div className="guest-feature-grid">
        {[
          ['reservations', 'My reservations', 'Follow, change or cancel your bookings.'],
          ['stays', 'My stays', 'View arrival, departure and room details.'],
          ['services', 'Guest services', 'Request available services during your stay.'],
          ['billing', 'My invoices', 'Review charges, payments and invoices.'],
          ['feedback', 'My feedback', 'Share your experience after your stay.'],
          ['profile', 'My account', 'Keep your contact and security details up to date.'],
        ].map(([path, title, text]) => (
          <Link className="card guest-account-card" key={path} to={`/user/${path}`}>
            <h2>{title}</h2>
            <p>{text}</p>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
    </>
  );
}
