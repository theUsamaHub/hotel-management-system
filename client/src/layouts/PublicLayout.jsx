import GuestLink from '../components/GuestLink.jsx';
import { Outlet } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import Navbar from '../components/Navbar.jsx';
export default function PublicLayout() {
  return (
    <div className="public-shell">
      <Navbar />
      <Outlet />
      <footer className="guest-footer">
        <div>
          <GuestLink className="brand" to="/">
            <Brand />
          </GuestLink>
          <p>Thoughtful stays. Connected hospitality.</p>
          <small>© {new Date().getFullYear()} Luxury Star Hotel</small>
        </div>
        <nav aria-label="Explore Luxury Star Hotel">
          <strong>Explore</strong>
          <GuestLink to="/stays">Rooms & stays</GuestLink>
          <GuestLink to="/about">Our story</GuestLink>
          <GuestLink to="/services">Guest services</GuestLink>
          <GuestLink to="/features">All guest features</GuestLink>
        </nav>
        <nav aria-label="Guest support">
          <strong>Your visit</strong>
          <GuestLink to="/help">Guest guide</GuestLink>
          <GuestLink to="/contact">Contact</GuestLink>
          <GuestLink to="/user/reservations">My reservations</GuestLink>
        </nav>
      </footer>
    </div>
  );
}
