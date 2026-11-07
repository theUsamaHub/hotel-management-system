import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Layers3, Menu, X } from 'lucide-react';
export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="navbar guest-navbar">
      <Link className="brand" to="/">
        <span className="brand-mark">
          <Layers3 size={22} />
        </span>
        LuxuryStay
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
        <Link className="button" to="/user/operations" onClick={() => setOpen(false)}>
          Book a stay
        </Link>
      </nav>
    </header>
  );
}
