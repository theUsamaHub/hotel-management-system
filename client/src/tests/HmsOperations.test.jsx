import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../api/axios.js';
import HmsOperations from '../pages/hms/HmsOperations.jsx';

const hotel = { _id: 'hotel1', name: 'LuxuryStay', city: 'Karachi', isActive: true };
const guest = { _id: 'guest1', name: 'Guest Example', email: 'guest@example.com', phone: '123' };
const type = {
  _id: 'type1',
  name: 'Double',
  capacity: 2,
  rate: 1250000,
  currency: 'PKR',
  isActive: true,
};
const room = {
  _id: 'room1',
  number: '101',
  floor: '1',
  roomType: type,
  status: 'available',
  isActive: true,
};
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const booking = {
  _id: 'booking1',
  reference: 'LS-example',
  hotel: hotel._id,
  room: room._id,
  guest: guest._id,
  contact: guest,
  occupants: 2,
  checkIn: future(1),
  checkOut: future(2),
  status: 'pending',
  version: 3,
  quote: { roomNumber: '101', rate: type.rate, currency: 'PKR', total: type.rate, nights: 1 },
};
function setup(role = 'admin', overrides = {}) {
  const pages = {
    hotels: [hotel],
    guests: [guest],
    rooms: [room],
    roomTypes: [type],
    reservations: [booking],
    events: [],
    ...overrides,
  };
  const reads = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    const resource = url.split('/').at(-1);
    const key =
      { 'room-types': 'roomTypes', availability: 'rooms', history: 'events' }[resource] || resource;
    return {
      data: {
        [key]: pages[key],
        pagination: { page: 1, pages: 1, total: pages[key]?.length || 0 },
      },
    };
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: { role } }}>
        <HmsOperations />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { reads, user: userEvent.setup() };
}
test('guest searches availability and reserves with their selected profile and dates', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { reservation: booking } });
  const { user } = setup('user');
  await user.click(await screen.findByRole('button', { name: 'Search availability' }));
  await user.click(await screen.findByRole('button', { name: 'Reserve room' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/hms/reservations',
      expect.objectContaining({
        hotel: 'hotel1',
        room: 'room1',
        guest: 'guest1',
        checkIn: future(1),
        checkOut: future(2),
        occupants: 1,
      }),
    ),
  );
  expect(await screen.findByRole('heading', { name: 'My reservations' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Confirm', exact: true })).not.toBeInTheDocument();
});
test('admin creates room type with major-unit price converted to integer minor units', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: 'Room types', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Add room type' }));
  await user.type(screen.getByLabelText('Type name'), 'Suite');
  await user.type(screen.getByLabelText('Nightly price'), '15000.50');
  await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/hms/room-types',
      expect.objectContaining({ hotel: 'hotel1', name: 'Suite', rate: 1500050, capacity: 2 }),
    ),
  );
});
test('reservation cancellation requires an explicit action and sends the observed version', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const { user } = setup('user');
  await user.click(await screen.findByRole('button', { name: 'My reservations', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
  expect(post).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Cancellation reason'), 'Plans changed');
  await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/reservations/booking1/cancel', {
      version: 3,
      reason: 'Plans changed',
    }),
  );
});
test('rescheduling searches availability excluding the current booking and keeps its version', async () => {
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const { user, reads } = setup('user');
  await user.click(await screen.findByRole('button', { name: 'My reservations', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'Modify / assign room' }));
  await user.click(screen.getByRole('button', { name: 'Search availability' }));
  await user.click(await screen.findByRole('button', { name: 'Save reservation' }));
  expect(reads).toHaveBeenCalledWith(
    '/hms/availability',
    expect.objectContaining({
      params: expect.objectContaining({ excludeReservation: 'booking1' }),
    }),
  );
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/hms/reservations/booking1',
      expect.objectContaining({ room: 'room1', version: 3, occupants: 2 }),
    ),
  );
});
test('housekeeping sees only rooms and can complete cleaning without inventory edit controls', async () => {
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
  const { user } = setup('housekeeping', { rooms: [{ ...room, status: 'cleaning' }] });
  await user.click(await screen.findByRole('button', { name: 'Change status' }));
  expect(screen.queryByRole('button', { name: 'Add room' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reservations' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Reason / completion details'), 'Cleaned and inspected');
  await user.click(screen.getByRole('button', { name: 'Save status' }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith('/hms/rooms/room1/status', {
      status: 'available',
      reason: 'Cleaned and inspected',
    }),
  );
});
test('guest cannot reserve without a profile and empty availability is explained', async () => {
  const { user } = setup('user', { guests: [], rooms: [] });
  expect(await screen.findByText('Create a guest profile to make a reservation.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Search availability' }));
  expect(await screen.findByText('No rooms match these dates and guest count.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Reserve room' })).not.toBeInTheDocument();
});
