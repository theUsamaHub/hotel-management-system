import { lazy, Suspense, act } from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import PageTransition from '../components/PageTransition.jsx';

test('first-time lazy navigation preserves the admin shell and resets its scroll position', async () => {
  let finishLoading;
  const NewPage = lazy(() => new Promise((resolve) => { finishLoading = resolve; }));
  render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <AuthContext.Provider value={{ user: { name: 'Admin', email: 'admin@example.com', role: 'admin' } }}>
        <PageTransition>
          <Suspense fallback={<p>Full screen loading</p>}>
            <Routes>
              <Route path="admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<Link to="/admin/users">Open new page</Link>} />
                <Route path="users" element={<NewPage />} />
              </Route>
            </Routes>
          </Suspense>
        </PageTransition>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  const navigation = screen.getByRole('navigation', { name: 'Workspace navigation' });
  const main = screen.getByRole('main');
  const pane = main.parentElement;
  pane.scrollTop = 500;
  await userEvent.click(screen.getByRole('link', { name: 'Open new page' }));
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBe(navigation);
  expect(navigation).toBeVisible();
  expect(screen.getByRole('main')).toBe(main);
  expect(pane.scrollTop).toBe(0);
  expect(screen.getByRole('status', { name: 'Loading' })).toBeVisible();
  expect(screen.queryByText('Full screen loading')).not.toBeInTheDocument();
  await act(async () => { finishLoading({ default: () => <h1>Loaded team page</h1> }); });
  expect(await screen.findByRole('heading', { name: 'Loaded team page' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBe(navigation);
});
