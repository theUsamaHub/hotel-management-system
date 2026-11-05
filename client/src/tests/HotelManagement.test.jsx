import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../api/axios.js';
import HotelManagement from '../pages/admin/HotelManagement.jsx';

const hotel = {
  _id: '507f1f77bcf86cd799439011',
  name: 'LuxuryStay Karachi',
  code: 'KHI',
  city: 'Karachi',
  country: 'Pakistan',
  address: '1 Main Road',
  email: 'hotel@example.com',
  phone: '',
  isActive: true,
};
function show(role = 'admin', staff = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: { role } }}>
        <HotelManagement staff={staff} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

test('administrator can edit hotel status and submit the updated record', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { hotels: [hotel], pagination: { page: 1, pages: 1, total: 1 } },
  });
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  await user.selectOptions(screen.getByLabelText('Status'), 'false');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      `/hotels/${hotel._id}`,
      expect.objectContaining({ isActive: false, code: 'KHI' }),
    ),
  );
});

test('manager sees assigned hotel without administrative controls', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { hotels: [hotel], pagination: { page: 1, pages: 1, total: 1 } },
  });
  show('manager');
  expect(await screen.findByText('LuxuryStay Karachi')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Add hotel' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});

test('staff creation sends the selected role and hotel with credentials', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      url === '/hotels'
        ? { hotels: [hotel], pagination: { pages: 1 } }
        : { staff: [], pagination: { page: 1, pages: 0, total: 0 } },
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  show('admin', true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add staff member' }));
  await user.type(screen.getByLabelText('Name'), 'New Manager');
  await user.type(screen.getByLabelText('Email'), 'manager@example.com');
  await user.type(screen.getByLabelText('Initial password'), 'Password123!');
  await user.selectOptions(screen.getByLabelText('Role'), 'manager');
  await user.selectOptions(screen.getByLabelText('Hotel'), hotel._id);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/staff',
      expect.objectContaining({ role: 'manager', hotel: hotel._id, email: 'manager@example.com' }),
    ),
  );
});
