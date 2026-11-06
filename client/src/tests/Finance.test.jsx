import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../api/axios.js';
import Billing from '../pages/hms/Billing.jsx';
import GuestServices from '../pages/hms/GuestServices.jsx';
import Feedback from '../pages/hms/Feedback.jsx';
import Stays from '../pages/hms/Stays.jsx';

const room = { _id: 'room1', number: '101' };
const reservation = {
  _id: 'booking1',
  reference: 'LS-1',
  contact: { name: 'Guest', email: 'guest@example.com' },
  checkIn: '2026-11-05',
  checkOut: '2026-11-07',
  quote: { currency: 'PKR', roomNumber: '101' },
};
const stay = {
  _id: 'stay1',
  status: 'active',
  room,
  reservation,
  version: 4,
  checkedInAt: '2026-11-05T10:00:00Z',
};
const service = {
  _id: 'service1',
  name: 'Laundry',
  unitPrice: 500,
  currency: 'PKR',
  isActive: true,
};
const invoice = {
  status: 'draft',
  lines: [{ description: 'Room 101', quantity: 2, unitAmount: 10000, total: 20000 }],
  subtotal: 20000,
  total: 20000,
  paid: 5000,
  balance: 15000,
  roomTotal: 20000,
  extraNights: 0,
  discount: 0,
  discountReason: '',
  tax: 0,
  taxBps: 0,
  currency: 'PKR',
  guest: reservation.contact,
  property: { name: 'Hotel', address: 'Main Rd', city: 'Karachi', country: 'Pakistan' },
  bookingReference: 'LS-1',
  payments: [],
  charges: [],
  version: 4,
};
const pagination = { page: 1, pages: 1, total: 1 };
function show(component, role = 'admin') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: { _id: 'user1', role } }}>
        {component}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return Object.assign(userEvent.setup(), { client });
}
test('billing records a deposit in minor units with an external receipt reference', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/hms/stays' ? { stays: [stay], pagination } : { bill: invoice, stay },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<Billing hotel="hotel1" />);
  await user.click(await screen.findByRole('button', { name: 'Record payment' }));
  await user.clear(screen.getByLabelText('Payment amount'));
  await user.type(screen.getByLabelText('Payment amount'), '50.25');
  await user.type(screen.getByLabelText('Unique receipt / payment reference'), 'RCPT-1');
  await user.click(screen.getByRole('button', { name: 'Save billing record' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/stays/stay1/payments', {
      version: 4,
      amount: 5025,
      method: 'cash',
      reference: 'RCPT-1',
    }),
  );
});
test('manager adjustments convert percentage to basis points and preserve discount reason', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/hms/stays' ? { stays: [stay], pagination } : { bill: invoice, stay },
  }));
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const user = show(<Billing hotel="hotel1" />, 'manager');
  await user.click(await screen.findByRole('button', { name: 'Tax / discount' }));
  await user.clear(screen.getByLabelText('Tax percentage'));
  await user.type(screen.getByLabelText('Tax percentage'), '12.5');
  await user.clear(screen.getByLabelText('Discount amount'));
  await user.type(screen.getByLabelText('Discount amount'), '10');
  await user.type(screen.getByLabelText('Discount reason'), 'Service recovery');
  await user.click(screen.getByRole('button', { name: 'Save billing record' }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/hms/stays/stay1/bill', {
      version: 4,
      taxBps: 1250,
      discount: 1000,
      discountReason: 'Service recovery',
    }),
  );
});
test('guest invoice is read-only, printable and emails without a client-chosen recipient', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [{ ...stay, status: 'completed' }], pagination }
        : {
            bill: { ...invoice, status: 'issued', number: 'INV-1' },
            stay: { ...stay, status: 'completed' },
          },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = show(<Billing hotel="hotel1" />, 'user');
  await user.click(await screen.findByRole('button', { name: 'Print bill / invoice' }));
  expect(print).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Email invoice' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/hms/stays/stay1/invoice/email', {}));
});
test('guest service request binds active stay and quantity without sending a price', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      ...(url === '/hms/stays'
        ? { stays: [stay] }
        : url === '/hms/services'
          ? { services: [service] }
          : { requests: [] }),
      pagination,
    },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<GuestServices hotel="hotel1" />, 'user');
  await user.click(screen.getByRole('button', { name: 'Request service' }));
  await screen.findByLabelText('Service stay');
  await user.selectOptions(screen.getByLabelText('Service stay'), 'stay1');
  await user.selectOptions(screen.getByLabelText('Requested service'), 'service1');
  await user.clear(screen.getByLabelText('Service quantity'));
  await user.type(screen.getByLabelText('Service quantity'), '2');
  await user.click(screen.getByRole('button', { name: 'Submit service request' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/service-requests', {
      stay: 'stay1',
      service: 'service1',
      quantity: 2,
      notes: '',
    }),
  );
});
test('guest submits one review for a completed stay', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [{ ...stay, status: 'completed' }], pagination }
        : {
            feedback: [],
            summary: { total: 0, average: 0 },
            pagination: { ...pagination, total: 0 },
          },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<Feedback hotel="hotel1" isGuest />, 'user');
  await screen.findByLabelText('Stay to review');
  await user.selectOptions(screen.getByLabelText('Stay to review'), 'stay1');
  await user.selectOptions(screen.getByLabelText('Stay rating'), '4');
  await user.type(screen.getByLabelText('Feedback comment'), 'Helpful staff');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/hms/feedback', {
      stay: 'stay1',
      rating: 4,
      comment: 'Helpful staff',
    }),
  );
});
test('checkout collects the bill balance after deposits, rather than the original room quote', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [stay], pagination }
        : {
            stay,
            reservation,
            keys: [],
            settlementDue: { roomTotal: 20000, extraNights: 0, currency: 'PKR' },
            billing: invoice,
          },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  const user = show(<Stays hotel="hotel1" isGuest={false} />);
  await user.click(await screen.findByRole('button', { name: 'Details & keys' }));
  await user.click(await screen.findByRole('button', { name: 'Check out', exact: true }));
  expect(screen.getByLabelText('Outstanding settlement amount')).toHaveValue(150);
  await user.type(screen.getByLabelText('External receipt / settlement reference'), 'FINAL-1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Confirm checkout' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/hms/stays/stay1/check-out',
      expect.objectContaining({ amount: 15000, version: 4, currency: 'PKR' }),
    ),
  );
});

test('an open adjustment form retains its observed version after a background refresh', async () => {
  let version = 4;
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hms/stays'
        ? { stays: [stay], pagination }
        : { bill: { ...invoice, version }, stay },
  }));
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const user = show(<Billing hotel="hotel1" />, 'manager');
  await user.click(await screen.findByRole('button', { name: 'Tax / discount' }));
  version = 5;
  await user.client.invalidateQueries({ queryKey: ['hms', 'bill', 'stay1'] });
  await user.click(screen.getByRole('button', { name: 'Save billing record' }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/hms/stays/stay1/bill',
      expect.objectContaining({ version: 4 }),
    ),
  );
});
