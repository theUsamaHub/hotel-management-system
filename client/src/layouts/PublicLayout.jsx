import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <Navbar />
      <Outlet />
      <footer>
        © {new Date().getFullYear()} LuxuryStay Hospitality{' '}
        <span>A little structure. A lot of possibility.</span>
      </footer>
    </div>
  );
}
