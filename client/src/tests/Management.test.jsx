import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/axios.js';
import { Policies, Notifications, Reports } from '../pages/hms/Management.jsx';
const policy = {
  version: 2,
  maxAdvanceDays: 730,
  maxStayNights: 365,
  cancellationDays: 0,
  taxBps: 0,
  allowSameDay: true,
  checkInHour: 0,
  checkOutHour: 0,
  weekendRateBps: 10000,
};
function show(component) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
  return { user: userEvent.setup(), client };
}
test('policy editor retains the version observed when opened, despite background refetch', async () => {
  let current = policy;
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: { policy: current, source: 'hotel' },
  }));
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const { user, client } = show(<Policies hotel="hotel1" canManage />);
  await user.click(await screen.findByRole('button', { name: 'Edit policy' }));
  current = { ...policy, version: 3 };
  await client.invalidateQueries({ queryKey: ['hms'] });
  const input = screen.getByLabelText('Default tax (basis points; 100 = 1%)');
  await user.clear(input);
  await user.type(input, '1500');
  await user.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/hms/policies', { ...policy, taxBps: 1500, hotel: 'hotel1' }),
  );
});
test('guests can read policy but cannot open its editor', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { policy, source: 'global' } });
  show(<Policies hotel="hotel1" canManage={false} />);
  expect(await screen.findByText(/Using global defaults/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit policy' })).not.toBeInTheDocument();
});
test('notifications mark only the selected item read and send unread filters', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({
      data: {
        notifications: [
          {
            _id: 'note1',
            message: 'Room 101 requires cleaning',
            module: 'housekeeping',
            createdAt: '2026-11-05T00:00:00Z',
            readAt: null,
          },
        ],
        pagination: { page: 1, pages: 1, total: 1 },
      },
    });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const { user } = show(<Notifications hotel="hotel1" />);
  await user.click(await screen.findByRole('button', { name: 'Mark read' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/hms/notifications/note1/read', {}));
  await user.click(screen.getByLabelText('Unread only'));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/hms/notifications', {
      params: { hotel: 'hotel1', page: 1, limit: 10, unread: 'true' },
    }),
  );
});
test('reports show empty data explicitly and apply the chosen period', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({
      data: {
        report: {
          reservations: [],
          payments: [],
          invoices: [],
          feedback: { count: 0, average: null },
          occupiedRoomNights: 0,
          inventory: {
            activeRooms: 0,
            occupiedNow: 0,
            occupancyPercentNow: null,
            availableForEntirePeriod: null,
          },
          daily: [],
          forecast: [],
          forecastHistory: { observedRoomNights: 0 },
        },
      },
    });
  const { user } = show(<Reports hotel="hotel1" />);
  expect(await screen.findByText('No payments recorded.')).toBeInTheDocument();
  const from = screen.getByLabelText('From (inclusive)');
  await user.clear(from);
  await user.type(from, '2026-01-01');
  const to = screen.getByLabelText('To (exclusive)');
  await user.clear(to);
  await user.type(to, '2026-02-01');
  await user.click(screen.getByRole('button', { name: 'Run report' }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/hms/reports', {
      params: { hotel: 'hotel1', from: '2026-01-01', to: '2026-02-01' },
    }),
  );
});
