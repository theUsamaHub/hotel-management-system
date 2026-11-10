import { test, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from './server.js';
import { AuthContext } from '../context/AuthContext.jsx';
import AccountLink from '../pages/public/AccountLink.jsx';
import Profile from '../pages/user/Profile.jsx';
import ActivityLog from '../pages/admin/ActivityLog.jsx';
import Login from '../pages/public/Login.jsx';

function LocationIndicator() {
  const location = useLocation();
  return (
    <span hidden data-testid="location">
      {location.pathname}
      {location.hash}
    </span>
  );
}

function renderAccount(component, path = '/', context = {}) {
  const auth = { user: null, clearSession: vi.fn(), updateUser: vi.fn(), ...context };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={component} />
          </Routes>
          <LocationIndicator />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return auth;
}
const account = {
  _id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  emailVerified: false,
};
const token = 'a'.repeat(64);

test('forgot password submits email and shows the generic confirmation', async () => {
  let body;
  server.use(
    http.post('*/api/auth/forgot-password', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ message: 'If eligible, check your inbox.' });
    }),
  );
  renderAccount(<AccountLink mode="forgot" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), account.email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If eligible');
  expect(body).toEqual({ email: account.email });
  expect(screen.getByRole('button', { name: /Resend reset link in/ })).toBeDisabled();
});

test('resend reuses the submitted email, handles failure, and restarts its cooldown on success', async () => {
  const bodies = [];
  server.use(
    http.post('*/api/auth/forgot-password', async ({ request }) => {
      bodies.push(await request.json());
      return bodies.length === 2
        ? HttpResponse.json({ message: 'Please try again' }, { status: 503 })
        : HttpResponse.json({ message: 'If eligible, check your inbox.' });
    }),
  );
  renderAccount(<AccountLink mode="forgot" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), account.email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('button', { name: /Resend reset link in/ })).toBeDisabled();
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Resend reset link' })).toBeEnabled(),
    { timeout: 2500 },
  );
  await user.click(screen.getByRole('button', { name: 'Resend reset link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
  await user.click(screen.getByRole('button', { name: 'Resend reset link' }));
  expect(await screen.findByRole('button', { name: /Resend reset link in/ })).toBeDisabled();
  expect(bodies).toEqual(Array(3).fill({ email: account.email }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('reset requires matching passwords and sends the fragment token only after submission', async () => {
  let body;
  server.use(
    http.post('*/api/auth/reset-password', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ message: 'Password reset. Sign in again.' });
    }),
  );
  const auth = renderAccount(<AccountLink mode="reset" />, `/reset-password#token=${token}`);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'NewPassword123!');
  await user.type(screen.getByLabelText('Confirm new password'), 'Mismatch123!');
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
  expect(body).toBeUndefined();
  await user.clear(screen.getByLabelText('Confirm new password'));
  await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword123!');
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Password reset');
  expect(body).toEqual({ token, password: 'NewPassword123!' });
  expect(auth.clearSession).toHaveBeenCalled();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/);
  expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Choose a new password' })).not.toBeInTheDocument();
});

test('password visibility controls toggle independently without submitting the reset form', async () => {
  let requests = 0;
  server.use(
    http.post('*/api/auth/reset-password', () => {
      requests++;
      return HttpResponse.json({});
    }),
  );
  renderAccount(<AccountLink mode="reset" />, `/reset-password#token=${token}`);
  const user = userEvent.setup();
  const password = screen.getByLabelText('New password');
  const confirmation = screen.getByLabelText('Confirm new password');
  await user.type(password, 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Show new password' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirmation).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: 'Hide new password' }));
  expect(password).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: 'Show confirm new password' }));
  expect(confirmation).toHaveAttribute('type', 'text');
  expect(requests).toBe(0);
});

test('email verification is explicit and shows expired-link errors', async () => {
  let sent = 0;
  server.use(
    http.post('*/api/auth/verify-email', () => {
      sent++;
      return HttpResponse.json({ message: 'Invalid or expired link' }, { status: 400 });
    }),
  );
  renderAccount(<AccountLink mode="verify" />, `/verify-email#token=${token}`);
  expect(sent).toBe(0);
  await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired link');
  expect(sent).toBe(1);
});

test('missing recovery token never displays a password submission form', () => {
  renderAccount(<AccountLink mode="reset" />, '/reset-password');
  expect(screen.getByRole('alert')).toHaveTextContent('missing or invalid');
  expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();
});

test('account settings save profile, request verification and revoke another device', async () => {
  let revoked = false;
  server.use(
    http.get('*/api/account/sessions', () =>
      HttpResponse.json({
        sessions: revoked
          ? []
          : [
              {
                _id: '2',
                current: false,
                userAgent: 'Firefox',
                createdAt: '2026-10-01',
                lastUsedAt: '2026-10-01',
              },
            ],
      }),
    ),
    http.patch('*/api/account/profile', async ({ request }) =>
      HttpResponse.json({ user: { ...account, ...(await request.json()) } }),
    ),
    http.post('*/api/account/resend-verification', () =>
      HttpResponse.json({ message: 'Check your inbox' }),
    ),
    http.delete('*/api/account/sessions/2', () => {
      revoked = true;
      return HttpResponse.json({ signedOut: false });
    }),
  );
  const auth = renderAccount(<Profile />, '/user/profile', { user: account });
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Full name'));
  await user.type(screen.getByLabelText('Full name'), 'Updated Name');
  await user.click(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() =>
    expect(auth.updateUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Name' })),
  );
  await user.click(screen.getByRole('button', { name: 'Send verification email' }));
  expect(await screen.findByText('Check your inbox')).toBeVisible();
  await user.click(await screen.findByRole('button', { name: 'Sign out device' }));
  await waitFor(() => expect(screen.queryByText('Firefox')).not.toBeInTheDocument());
});

test('activity log filters admin events and renders returned records', async () => {
  let selected;
  server.use(
    http.get('*/api/audit', ({ request }) => {
      selected = new URL(request.url).searchParams.get('action');
      return HttpResponse.json({
        actions: ['category.delete'],
        events: [
          {
            _id: '1',
            action: 'category.delete',
            actor: { name: 'Admin One', _id: 'actor-123', role: 'admin' },
            actorSnapshot: { name: 'Admin One', id: 'actor-123', role: 'admin' },
            target: '123',
            createdAt: '2026-10-01',
          },
        ],
        pagination: { page: 1, pages: 1, total: 1 },
      });
    }),
  );
  renderAccount(<ActivityLog />);
  expect(await screen.findByText('Admin One')).toBeVisible();
  expect(screen.getByText('actor-123')).toBeVisible();
  expect(screen.getByRole('columnheader', { name: 'Role at action' })).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText('Filter activity'), 'category.delete');
  await waitFor(() => expect(selected).toBe('category.delete'));
  expect(within(screen.getByRole('table')).getByText('category.delete')).toBeVisible();
});
