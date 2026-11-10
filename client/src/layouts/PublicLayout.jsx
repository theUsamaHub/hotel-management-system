import { Outlet, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
export default function PublicLayout() {
  return (
    <div className="public-shell">
      <Navbar />
      <Outlet />
      <footer className="guest-footer">
        <div>
          <Link className="brand" to="/">
            LuxuryStay
          </Link>
          <p>Thoughtful stays. Connected hospitality.</p>
          <small>© {new Date().getFullYear()} LuxuryStay Hospitality</small>
        </div>
        <nav aria-label="Explore LuxuryStay">
          <strong>Explore</strong>
          <Link to="/stays">Rooms & stays</Link>
          <Link to="/about">Our story</Link>
          <Link to="/services">Guest services</Link>
          <Link to="/features">All guest features</Link>
        </nav>
        <nav aria-label="Guest support">
          <strong>Your visit</strong>
          <Link to="/help">Guest guide</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/user/reservations">My reservations</Link>
        </nav>
      </footer>
    </div>
  );
}
