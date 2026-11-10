import Brand from './Brand.jsx';
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Layers3,
  LayoutDashboard,
  FolderOpen,
  Users,
  UserRound,
  ArrowUpRight,
  LogOut,
  Images,
  History,
  Building2,
} from 'lucide-react';
import useAuth from '../hooks/useAuth.js';
import toast from 'react-hot-toast';
import { errorMessage } from '../api/axios.js';

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const admin = user.role === 'admin';
  const root = admin ? '/admin' : '/user';
  const links = [
    ['dashboard', 'Overview', LayoutDashboard],
    ['operations', user.role === 'user' ? 'Book a stay' : 'Hotel operations', Building2],
    ...(user.role !== 'user' ? [['hotels', 'Hotels & branches', Building2]] : []),
    ...(['admin', 'manager'].includes(user.role) ? [['staff', 'Hotel staff', Users]] : []),
    ...(user.role === 'user'
      ? [
          ['reservations', 'My reservations', History],
          ['stays', 'My stays', Building2],
          ['services', 'Guest services', Layers3],
          ['billing', 'My invoices', FolderOpen],
          ['feedback', 'My feedback', UserRound],
        ]
      : [['categories', 'Categories', FolderOpen]]),
    ...(user.role !== 'user' ? [['media', 'Media library', Images]] : []),
    ...(admin
      ? [
          ['users', 'Team members', Users],
          ['activity', 'Activity log', History],
        ]
      : []),
    ['profile', 'Account settings', UserRound],
  ];
  return (
    <aside className={`sidebar ${menuOpen ? 'menu-open' : ''}`} data-lenis-prevent>
      <Link to="/" className="brand">
        <Brand />
      </Link>
      <div className="workspace-label">
        <span className="workspace-icon">L</span>
        <div>
          Hotel workspace<small>{user.role === 'user' ? 'Guest account' : 'Hotel team'}</small>
        </div>
        <span className="badge">{user.role.toUpperCase()}</span>
      </div>
      <p className="eyebrow">Workspace</p>
      <button
        className="button secondary mobile-menu"
        aria-expanded={menuOpen}
        aria-controls="workspace-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? 'Close navigation' : 'Menu'}
      </button>
      <nav id="workspace-navigation" aria-label="Workspace navigation">
        {links.map(([path, label, Icon]) => (
          <NavLink onClick={() => setMenuOpen(false)} key={path} to={`${root}/${path}`}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <Layers3 size={20} />
          <h3>Hospitality, together.</h3>
          <p>
            Every guest. Every detail.
            <br />
            A memorable stay starts here.
          </p>
          <Link to="/">
            Explore Luxury Star Hotel <ArrowUpRight size={14} />
          </Link>
        </div>
        <button
          className="signout"
          onClick={() => logout().catch((error) => toast.error(errorMessage(error)))}
        >
          <LogOut size={17} />
          Sign out
        </button>
        <div className="account">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
