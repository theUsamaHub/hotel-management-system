import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../api/axios.js';
import Stays, { CheckInForm } from '../pages/hms/Stays.jsx';
import WorkOrders from '../pages/hms/WorkOrders.jsx';

const room = { _id: 'room1', number: '101', status: 'occupied' };
const booking = {
  _id: 'booking1',
  reference: 'LS-demo',
  room: 'room1',
  status: 'confirmed',
  version: 2,
  checkIn: '2026-11-05',
  checkOut: '2026-11-07',
  contact: { name: 'Guest', email: 'guest@example.com' },
  quote: { roomNumber: '101', total: 20000, currency: 'PKR' },
};
const stay = {
  _id: 'stay1',
  room,
  reservation: booking,
  checkedInAt: '2026-11-05T10:00:00Z',
  status: 'active',
  version: 3,
};
const key = { _id: 'key1', label: '101-A', status: 'returned', issuedAt: stay.checkedInAt };
function show(component, role = 'admin') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: { _id: 'worker1', role } }}>
        {component}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
function mockWork({ tasks = [], requests = [], stays = [stay] } = {}) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    const data =
      url === '/hms/stays'
        ? { stays }
        : url === '/hms/rooms' || url === '/hms/housekeeping/queue'
          ? { rooms: [room] }
          : url === '/hms/assignees'
            ? { staff: [{ _id: 'worker1', name: 'Worker' }] }
            : url === '/hms/maintenance'
              ? { requests }
              : { tasks };
    return { data: { ...data, pagination: { page: 1, pages: 1, total: 1 } } };
  });
}
test('check-in records verification and parses physical key labels', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const close = vi.fn();
  const user = show(<CheckInForm booking={booking} close={close} />);
  await user.type(screen.getByLabelText('Verification note'), 'Booking contact verified');
  await user.type(
    screen.getByLabelText('Key labels (comma-separated, up to five)'),
    '101-A, 101-B',
  );
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Confirm check-in' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/reservations/booking1/check-in', {
      version: 2,
      guestVerified: true,
      verificationNote: 'Booking contact verified',
      keys: ['101-A', '101-B'],
    }),
  );
  expect(close).toHaveBeenCalled();
});
test('checkout records explicit external settlement in minor currency units', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [stay], pagination: { page: 1, pages: 1, total: 1 } }
        : {
            stay: { ...stay, reservation: 'booking1' },
            reservation: booking,
            keys: [key],
            settlementDue: { roomTotal: 20000, currency: 'PKR', extraNights: 0 },
          },
  }));
  const user = show(<Stays hotel="hotel1" isGuest={false} />);
  await user.click(await screen.findByRole('button', { name: 'Details & keys' }));
  await user.click(await screen.findByRole('button', { name: 'Check out', exact: true }));
  await user.type(screen.getByLabelText('External receipt / settlement reference'), 'Receipt-01');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Confirm checkout' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/stays/stay1/check-out', {
      version: 3,
      amount: 20000,
      currency: 'PKR',
      method: 'cash',
      reference: 'Receipt-01',
      billingReviewed: true,
    }),
  );
});
test('issued keys block checkout in the screen and lost-key reporting includes a reason', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [stay], pagination: { page: 1, pages: 1, total: 1 } }
        : {
            stay: { ...stay, reservation: 'booking1' },
            reservation: booking,
            keys: [{ ...key, status: 'issued' }],
            settlementDue: { roomTotal: 20000, currency: 'PKR', extraNights: 0 },
          },
  }));
  const user = show(<Stays hotel="hotel1" isGuest={false} />);
  await user.click(await screen.findByRole('button', { name: 'Details & keys' }));
  await user.click(await screen.findByRole('button', { name: 'Return / report lost' }));
  expect(screen.queryByRole('button', { name: 'Check out', exact: true })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Key outcome'), 'lost');
  await user.type(screen.getByLabelText('Key return / loss note'), 'Guest lost key');
  await user.click(screen.getByRole('button', { name: 'Record key outcome' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/stays/stay1/keys/key1/close', {
      version: 3,
      status: 'lost',
      note: 'Guest lost key',
    }),
  );
});
test('front desk schedules cleaning with a hotel worker', async () => {
  mockWork();
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<WorkOrders hotel="hotel1" />, 'receptionist');
  await user.click(screen.getByRole('button', { name: 'Schedule cleaning' }));
  await screen.findByRole('option', { name: '101' });
  await user.selectOptions(screen.getByLabelText('Room'), 'room1');
  await user.selectOptions(screen.getByLabelText('Assigned worker'), 'worker1');
  await user.type(screen.getByLabelText('Cleaning instructions'), 'Departure cleaning');
  await user.click(screen.getByRole('button', { name: 'Save work order' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/hms/housekeeping',
      expect.objectContaining({
        hotel: 'hotel1',
        room: 'room1',
        assignedTo: 'worker1',
        notes: 'Departure cleaning',
      }),
    ),
  );
});
test('guest reports their current room without staff assignment or blocking controls', async () => {
  mockWork();
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<WorkOrders hotel="hotel1" maintenance />, 'user');
  await user.click(screen.getByRole('button', { name: 'Report issue' }));
  await screen.findByRole('option', { name: '101' });
  await user.selectOptions(screen.getByLabelText('Room'), 'room1');
  await user.type(screen.getByLabelText('Issue title'), 'AC not cooling');
  await user.type(screen.getByLabelText('Issue description'), 'Please inspect the air conditioner');
  expect(screen.queryByLabelText('Block booking and check-in')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Assigned worker')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save work order' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/hms/maintenance',
      expect.objectContaining({
        room: 'room1',
        title: 'AC not cooling',
        blocksRoom: false,
        assignedTo: null,
      }),
    ),
  );
});
test('assigned repairer resolves work with its version and resolution notes', async () => {
  mockWork({
    requests: [
      {
        _id: 'request1',
        room,
        title: 'AC repair',
        description: 'Check cooling',
        priority: 'high',
        status: 'in_progress',
        version: 4,
        assignedTo: { _id: 'worker1', name: 'Worker' },
        blocksRoom: true,
      },
    ],
  });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<WorkOrders hotel="hotel1" maintenance />, 'maintenance');
  await user.click(await screen.findByRole('button', { name: 'Resolve repair' }));
  expect(screen.queryByRole('button', { name: 'Assign / edit' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Work / resolution notes'), 'Repaired and safety tested');
  await user.click(screen.getByRole('button', { name: 'Confirm work action' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/maintenance/request1/action', {
      version: 4,
      action: 'resolve',
      notes: 'Repaired and safety tested',
    }),
  );
});
