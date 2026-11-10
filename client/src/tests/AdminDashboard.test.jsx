import { test, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from './server.js';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';

const fixture = (currency = 'PKR') => ({
  generatedAt: '2026-11-10T12:00:00Z',
  currency,
  days: 7,
  hotels: [{ _id: 'hotel-1', name: 'Demo hotel', isActive: true }],
  period: {
    from: '2026-11-04',
    to: '2026-11-11',
    previousFrom: '2026-10-28',
    previousTo: '2026-11-04',
  },
  totals: {
    payments: { current: 10000, previous: 0, change: 10000, percent: null },
    invoices: { current: 5000, previous: 10000, change: -5000, percent: -50 },
    bookings: { current: 2, previous: 1, change: 1, percent: 100 },
  },
  daily: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-11-${String(i + 4).padStart(2, '0')}`,
    previousDate: new Date(Date.UTC(2026, 9, 28 + i)).toISOString().slice(0, 10),
    payments: i === 0 ? 10000 : 0,
    previousPayments: 0,
    bookings: i === 0 ? 2 : 0,
    previousBookings: i === 0 ? 1 : 0,
    invoices: i === 0 ? 5000 : 0,
    previousInvoices: i === 0 ? 10000 : 0,
  })),
  inventory: { total: 9, occupied: 1, occupancyPercent: 100 / 9, blocked: 1 },
  properties: { total: 1, active: 1 },
  staff: 4,
  feedback: { count: 0, average: null },
  roomStates: [
    { _id: 'available', count: 8 },
    { _id: 'occupied', count: 1 },
  ],
  bookingStates: [{ _id: 'pending', count: 2 }],
  queues: {
    arrivals: 1,
    departures: 0,
    overdue: 0,
    pendingBookings: 2,
    cleaning: 1,
    maintenance: 2,
    services: 1,
  },
  upcoming: [],
});
function mount() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
test('dashboard shows real financial units, honest growth, operational details and accessible chart tables', async () => {
  server.use(http.get('*/api/admin/dashboard', () => HttpResponse.json({ dashboard: fixture() })));
  mount();
  expect(await screen.findByText('No previous activity')).toBeVisible();
  expect(screen.getByText('-50.0% vs previous period')).toBeVisible();
  expect(screen.getByText('+100.0% vs previous period')).toBeVisible();
  expect(screen.getByText('No reviews')).toBeVisible();
  expect(screen.getByText('11.1%')).toBeVisible();
  const card = screen.getByText('Payments recorded').closest('article');
  expect(within(card).getByText(/PKR\s*100\.00/)).toBeVisible();
  await userEvent.click(screen.getByText('View payment trend data'));
  expect(screen.getByRole('table', { name: /Payment trend/ })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Work requiring attention' })).toBeVisible();
  expect(screen.queryByText('Total categories')).not.toBeInTheDocument();
});
test('property, period and currency controls request the selected scope', async () => {
  const requests = [];
  server.use(
    http.get('*/api/admin/dashboard', ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      requests.push(params);
      return HttpResponse.json({ dashboard: fixture(params.currency) });
    }),
  );
  mount();
  await screen.findByText('Payments recorded');
  await userEvent.selectOptions(screen.getByLabelText('Hotel property'), 'hotel-1');
  await userEvent.selectOptions(screen.getByLabelText('Reporting period'), '7');
  await userEvent.selectOptions(screen.getByLabelText('Financial currency'), 'USD');
  await waitFor(() =>
    expect(requests.at(-1)).toEqual({ hotel: 'hotel-1', days: '7', currency: 'USD' }),
  );
  await waitFor(() =>
    expect(
      within(screen.getByText('Payments recorded').closest('article')).getByText('$100.00'),
    ).toBeVisible(),
  );
});
test('empty analytics show no invented occupancy, rating or growth', async () => {
  const empty = fixture();
  empty.inventory = { total: 0, occupied: 0, occupancyPercent: null, blocked: 0 };
  empty.totals = Object.fromEntries(
    ['payments', 'bookings', 'invoices'].map((key) => [
      key,
      { current: 0, previous: 0, change: 0, percent: null },
    ]),
  );
  empty.daily = empty.daily.map((row) => ({
    ...row,
    payments: 0,
    previousPayments: 0,
    bookings: 0,
    previousBookings: 0,
    invoices: 0,
    previousInvoices: 0,
  }));
  server.use(http.get('*/api/admin/dashboard', () => HttpResponse.json({ dashboard: empty })));
  mount();
  expect(await screen.findByText('N/A')).toBeVisible();
  expect(screen.getAllByText('No activity in either period')).toHaveLength(3);
  expect(screen.getAllByText('No recorded activity in either period.')).toHaveLength(3);
});

test('failed analytics display an error and can be retried', async () => {
  let available = false;
  server.use(
    http.get('*/api/admin/dashboard', () =>
      available
        ? HttpResponse.json({ dashboard: fixture() })
        : HttpResponse.json({ message: 'Analytics temporarily unavailable' }, { status: 503 }),
    ),
  );
  mount();
  expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
    'Analytics temporarily unavailable',
  );
  available = true;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Payments recorded')).toBeVisible();
});
