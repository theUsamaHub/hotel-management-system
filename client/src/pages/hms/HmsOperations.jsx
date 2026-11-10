import { Policies, Notifications, Reports, Monitoring } from './Management.jsx';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth.js';
import { all, Field, QueryContent } from './shared.jsx';
import Inventory from './Inventory.jsx';
import Guests from './Guests.jsx';
import SearchRooms from './SearchRooms.jsx';
import Reservations from './Reservations.jsx';
import Stays from './Stays.jsx';
import WorkOrders from './WorkOrders.jsx';
import Billing from './Billing.jsx';
import GuestServices from './GuestServices.jsx';
import Feedback from './Feedback.jsx';

function HotelWorkspace({ hotel, role, initialTab }) {
  const isGuest = role === 'user';
  const canBook = ['admin', 'manager', 'receptionist', 'user'].includes(role);
  const canManage = ['admin', 'manager'].includes(role);
  const [params, setParams] = useSearchParams();
  const defaultTab = initialTab || (isGuest ? 'search' : 'rooms');
  function setTab(value) {
    setParams((current) => { const next = new URLSearchParams(current); next.set('tab', value); return next; });
  }
  const [editing, setEditing] = useState(null);
  const tabs = [
    ...(!isGuest ? [['rooms', 'Rooms']] : []),
    ...(canManage ? [['types', 'Room types']] : []),
    ...(canBook
      ? [
          ['guests', isGuest ? 'My guest profile' : 'Guests'],
          ['search', 'Find rooms'],
          ['reservations', isGuest ? 'My reservations' : 'Reservations'],
          ['stays', isGuest ? 'My stays' : 'Guest stays'],
          ['billing', 'Billing & invoices'],
        ]
      : []),
    ...(['admin', 'manager', 'receptionist', 'housekeeping'].includes(role)
      ? [['housekeeping', 'Housekeeping']]
      : []),
    ['maintenance', isGuest ? 'Report a problem' : 'Maintenance'],
    ['services', 'Guest services'],
    ['policies', 'Hotel policies'],
    ...(role === 'admin'
      ? [
          ['settings', 'Global settings'],
          ['monitoring', 'Monitoring'],
        ]
      : []),
    ['notifications', 'Notifications'],
    ...(canManage ? [['reports', 'Reports']] : []),
    ...(canManage || isGuest ? [['feedback', isGuest ? 'My feedback' : 'Guest feedback']] : []),
  ];
  const requestedTab = params.get('tab') || defaultTab;
  const tab = tabs.some(([value]) => value === requestedTab) ? requestedTab : defaultTab;
  function navigate(value) {
    setEditing(null);
    setTab(value);
  }
  return (
    <>
      <nav className="hms-tabs" aria-label="Hotel modules">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={`button ${tab === value ? '' : 'secondary'}`}
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => navigate(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'monitoring' && <Monitoring />}
      {tab === 'settings' && <Policies key="global" hotel={hotel} canManage global />}
      {tab === 'policies' && <Policies hotel={hotel} canManage={canManage} />}
      {tab === 'notifications' && (
        <Notifications
          hotel={hotel}
          openModule={(module) => {
            if (tabs.some(([value]) => value === module)) navigate(module);
          }}
        />
      )}
      {tab === 'reports' && <Reports hotel={hotel} />}
      {tab === 'rooms' && <Inventory hotel={hotel} role={role} />}
      {tab === 'billing' && <Billing hotel={hotel} />}
      {tab === 'services' && <GuestServices hotel={hotel} />}
      {tab === 'feedback' && <Feedback hotel={hotel} isGuest={isGuest} />}
      {tab === 'stays' && <Stays hotel={hotel} isGuest={isGuest} />}
      {tab === 'housekeeping' && <WorkOrders key="housekeeping" hotel={hotel} />}
      {tab === 'maintenance' && <WorkOrders key="maintenance" hotel={hotel} maintenance />}
      {tab === 'types' && <Inventory key="types" hotel={hotel} role={role} types />}
      {tab === 'guests' && <Guests hotel={hotel} isGuest={isGuest} />}
      {tab === 'search' && (
        <SearchRooms
          key={editing?._id || 'new'}
          hotel={hotel}
          editing={editing}
          done={() => navigate('reservations')}
          profiles={() => navigate('guests')}
        />
      )}
      {tab === 'reservations' && (
        <Reservations
          hotel={hotel}
          isGuest={isGuest}
          edit={(row) => {
            setEditing(row);
            setTab('search');
          }}
        />
      )}
    </>
  );
}
export default function HmsOperations({ initialTab }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState('');
  const hotels = useQuery({
    queryKey: ['hms', 'hotel-options'],
    queryFn: () => all('hotels', 'hotels'),
  });
  const selectedHotel = hotels.data?.find((hotel) => hotel._id === selected) || hotels.data?.[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Luxury Star Hotel</p>
          <h1>
            {user.role === 'user'
              ? {
                  reservations: 'My reservations',
                  stays: 'My stays',
                  services: 'Guest services',
                  billing: 'My invoices',
                  feedback: 'My feedback',
                }[initialTab] || 'Plan your stay'
              : 'Hotel operations'}
          </h1>
          <p>Reservations, guest stays and daily hotel operations.</p>
        </div>
      </div>
      <QueryContent query={hotels}>
        {(rows) =>
          rows.length ? (
            <>
              <section className="card hms-form">
                <Field
                  label="Hotel property"
                  name="hotel"
                  value={selectedHotel._id}
                  change={(_name, value) => setSelected(value)}
                  options={rows.map((hotel) => [
                    hotel._id,
                    `${hotel.name} · ${hotel.city}${hotel.isActive ? '' : ' (inactive — history only)'}`,
                  ])}
                />
              </section>
              <section className="hotel-contact card">
                <strong>{selectedHotel.name}</strong>
                <p>
                  {selectedHotel.address} - {selectedHotel.city}
                </p>
                {selectedHotel.email && (
                  <p>
                    Email: <a href={`mailto:${selectedHotel.email}`}>{selectedHotel.email}</a>
                  </p>
                )}
                {selectedHotel.phone && <p>Phone: {selectedHotel.phone}</p>}
              </section>
              <HotelWorkspace
                initialTab={initialTab}
                key={selectedHotel._id}
                hotel={selectedHotel._id}
                role={user.role}
              />
            </>
          ) : (
            <section className="card empty">
              No hotels are available.{' '}
              {user.role === 'admin'
                ? 'Add a hotel from Hotels & branches first.'
                : 'Contact the hotel administrator for assistance.'}
            </section>
          )
        }
      </QueryContent>
    </>
  );
}
