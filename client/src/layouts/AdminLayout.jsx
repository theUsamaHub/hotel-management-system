import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '../api/axios.js';
import Sidebar from '../components/Sidebar.jsx';
import useAuth from '../hooks/useAuth.js';

export default function AdminLayout() {
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
    <div className="workspace-shell">
      <Sidebar />
      <div className="workspace-main">
        <header className="workspace-topbar admin-topbar">
          <span>
            Workspace <span className="muted">/ Administration</span>
          </span>
          <div>
            <span className="status-dot" />
            <span className="connection-label">Administration</span>
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
        <main className="workspace-content">
          <Outlet />
        </main>
        <div className="workspace-footer">
          Thoughtful service. Exceptional stays.<span>Luxury Star Hotel</span>
        </div>
      </div>
    </div>
  );
}
