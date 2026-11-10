import { test, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Navbar from '../components/Navbar.jsx';
import GuestPage from '../pages/public/GuestPage.jsx';
afterEach(() => {
  localStorage.removeItem('theme');
  document.documentElement.classList.remove('dark');
});
test('theme selection persists and restores after remount', async () => {
  localStorage.setItem('theme', 'light');
  const first = render(<ThemeToggle />);
  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.documentElement).toHaveClass('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
  first.unmount();
  render(<ThemeToggle />);
  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
});
test('guest menu expands and closes when a destination is selected', async () => {
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
  const open = screen.getByRole('button', { name: 'Open menu' });
  await userEvent.click(open);
  expect(open).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('link', { name: 'Our story' }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
test('guest guide explains real booking and payment rules', () => {
  render(
    <MemoryRouter>
      <GuestPage page="help" />
    </MemoryRouter>,
  );
  expect(screen.getByText('How do payments work?')).toBeInTheDocument();
  expect(screen.getByText(/does not process online card payments/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Explore availability/ })).toHaveAttribute(
    'href',
    '/user/operations',
  );
});

test('feature directory describes actual guest capabilities and links to booking', () => {
  render(
    <MemoryRouter>
      <GuestPage page="features" />
    </MemoryRouter>,
  );
  for (const name of [
    'Room availability',
    'Your guest profile',
    'Booking management',
    'Room issue reporting',
    'Bills, payments & invoices',
    'Post-stay feedback',
  ]) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByText(/online card charging is not provided/)).toBeInTheDocument();
});
