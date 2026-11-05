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
  const { user, logout } = useAuth();
  const admin = user.role === 'admin';
  const root = admin ? '/admin' : '/user';
  const links = [
    ['dashboard', 'Overview', LayoutDashboard],
    ...(user.role !== 'user' ? [['hotels', 'Hotels & branches', Building2]] : []),
    ...(['admin', 'manager'].includes(user.role) ? [['staff', 'Hotel staff', Users]] : []),
    ['categories', 'Categories', FolderOpen],
    ['media', 'Media library', Images],
    ...(admin ? [['users', 'Team members', Users], ['activity', 'Activity log', History]] : []),
    ['profile', 'Account settings', UserRound],
  ];
  return (
    <aside className="sidebar" data-lenis-prevent>
      <Link to="/" className="brand">
        <span className="brand-mark">
          <Layers3 size={22} />
        </span>
        forma<span className="brand-dot">®</span>
      </Link>
      <div className="workspace-label">
        <span className="workspace-icon">F</span>
        <div>
          My workspace<small>{admin ? 'Administrator' : 'Personal account'}</small>
        </div>
        <span className="badge">{admin ? 'ADMIN' : 'USER'}</span>
      </div>
      <p className="eyebrow">Workspace</p>
      <nav aria-label="Workspace navigation">
        {links.map(([path, label, Icon]) => (
          <NavLink key={path} to={`${root}/${path}`}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <Layers3 size={20} />
          <h3>Space to grow.</h3>
          <p>
            Everything in its place.
            <br />
            More room for what matters.
          </p>
          <Link to="/">
            Explore Forma <ArrowUpRight size={14} />
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
