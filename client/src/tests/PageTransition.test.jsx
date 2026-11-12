import { lazy, Suspense } from 'react';
import { test, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import PageTransition from '../components/PageTransition.jsx';

function shell() {
  return (
    <PageTransition>
      <Suspense fallback={<p role="status">Loading page</p>}>
        <Outlet />
      </Suspense>
    </PageTransition>
  );
}

test('rapid user route changes keep the final page visible without waiting for animation frames', async () => {
  const router = createMemoryRouter(
    [
      {
        element: shell(),
        children: [
          { path: '/user/dashboard', element: <h1>User dashboard</h1> },
          { path: '/user/categories', element: <h1>Discover categories</h1> },
        ],
      },
    ],
    { initialEntries: ['/user/dashboard'] },
  );
  render(<RouterProvider router={router} />);
  for (const path of [
    '/user/categories',
    '/user/dashboard',
    '/user/categories',
    '/user/dashboard',
  ]) {
    await act(async () => {
      await router.navigate(path);
    });
    expect(screen.getByRole('heading')).toBeVisible();
  }
  expect(screen.getByRole('heading', { name: 'User dashboard' })).toBeVisible();
  router.dispose();
});

test('a slow lazy page retains visible content during a transition and can be left and revisited', async () => {
  let finishLoading;
  const Categories = lazy(
    () =>
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
  );
  const router = createMemoryRouter(
    [
      {
        element: shell(),
        children: [
          { path: '/user/dashboard', element: <h1>User dashboard</h1> },
          { path: '/user/categories', element: <Categories /> },
        ],
      },
    ],
    { initialEntries: ['/user/dashboard'] },
  );
  render(<RouterProvider router={router} />);
  await act(async () => {
    await router.navigate('/user/categories');
  });
  expect(screen.getByRole('heading', { name: 'User dashboard' })).toBeVisible();
  await act(async () => {
    await router.navigate('/user/dashboard');
  });
  expect(screen.getByRole('heading', { name: 'User dashboard' })).toBeVisible();
  await act(async () => {
    finishLoading({ default: () => <h1>Discover categories</h1> });
  });
  await act(async () => {
    await router.navigate('/user/categories');
  });
  expect(screen.getByRole('heading', { name: 'Discover categories' })).toBeVisible();
  router.dispose();
});
