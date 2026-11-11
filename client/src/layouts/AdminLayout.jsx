import { Outlet, useLocation } from 'react-router-dom';
import '../admin-glass.css';
import { Suspense, useEffect, useRef, useState } from 'react';
import Loader from '../components/Loader.jsx';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '../api/axios.js';
import Sidebar from '../components/Sidebar.jsx';
import useAuth from '../hooks/useAuth.js';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const scrollPane = useRef(null);
  useEffect(() => {
    if (scrollPane.current) scrollPane.current.scrollTop = 0;
  }, [pathname]);
  const pageLabel =
    {
      dashboard: 'Overview',
      operations: 'Hotel operations',
      hotels: 'Hotels & branches',
      staff: 'Hotel staff',
      categories: 'Categories',
      media: 'Media library',
      users: 'Team members',
      activity: 'Activity log',
      profile: 'Account settings',
    }[pathname.split('/')[2]] || 'Administration';
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <div className="workspace-shell admin-glass">
      <a className="admin-skip" href="#admin-content">
        Skip to content
      </a>
      <Sidebar />
      <div className="workspace-main" ref={scrollPane}>
        <header className="workspace-topbar admin-topbar">
          <span>
            Administration <span className="muted">/ {pageLabel}</span>
          </span>
          <div>
            <span className="connection-label">{user.name}</span>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <button
              className="button secondary admin-signout"
              onClick={signOut}
              disabled={signingOut}
            >
              <LogOut size={16} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        <main className="workspace-content" id="admin-content" tabIndex={-1}>
          <Suspense key={pathname} fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
        <div className="workspace-footer">
          Thoughtful service. Exceptional stays.<span>Luxury Star Hotel</span>
        </div>
      </div>
    </div>
  );
}
