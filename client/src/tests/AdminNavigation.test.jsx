import { lazy, Suspense, act } from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import UserLayout from '../layouts/UserLayout.jsx';
import PageTransition from '../components/PageTransition.jsx';

test.each(['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'user'])(
  'first-time lazy navigation preserves the %s shell and resets its scroll position',
  async (role) => {
    const root = role === 'admin' ? 'admin' : 'user';
    let finishLoading;
    const NewPage = lazy(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
    );
    render(
      <MemoryRouter initialEntries={[`/${root}/dashboard`]}>
        <AuthContext.Provider value={{ user: { name: 'Admin', email: 'admin@example.com', role } }}>
          <PageTransition>
            <Suspense fallback={<p>Full screen loading</p>}>
              <Routes>
                <Route path={root} element={role === 'admin' ? <AdminLayout /> : <UserLayout />}>
                  <Route
                    path="dashboard"
                    element={<Link to={`/${root}/profile`}>Open new page</Link>}
                  />
                  <Route path="profile" element={<NewPage />} />
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
    await act(async () => {
      finishLoading({ default: () => <h1>Loaded team page</h1> });
    });
    expect(await screen.findByRole('heading', { name: 'Loaded team page' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBe(navigation);
  },
);
