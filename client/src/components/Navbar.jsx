import Brand from './Brand.jsx';
import GuestLink from './GuestLink.jsx';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="navbar guest-navbar">
      <Link className="brand" to="/">
        <Brand />
      </Link>
      <button
        className="icon-button guest-nav-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="guest-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav id="guest-navigation" className={open ? 'is-open' : ''} aria-label="Main navigation">
        {[
          ['/stays', 'Stays'],
          ['/about', 'Our story'],
          ['/services', 'Services'],
          ['/features', 'Features'],
          ['/help', 'Guest guide'],
          ['/contact', 'Contact'],
        ].map(([path, title]) => (
          <NavLink key={path} to={path} onClick={() => setOpen(false)}>
            {title}
          </NavLink>
        ))}
        <Link to="/login" onClick={() => setOpen(false)}>
          Sign in
        </Link>
        <GuestLink className="button" to="/user/operations" onClick={() => setOpen(false)}>
          Book a stay
        </GuestLink>
      </nav>
    </header>
  );
}
