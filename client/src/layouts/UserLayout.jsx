import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import useAuth from '../hooks/useAuth.js';
export default function UserLayout() {
  const { user } = useAuth();
  return (
    <div className="workspace-shell">
      <Sidebar />
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span>
            Workspace <span className="muted">/ Your space</span>
          </span>
          <div>
            <span className="status-dot" />
            Connected <span className="avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="workspace-content">
          <Outlet />
        </main>
        <div className="workspace-footer">
          Make space for what matters.<span>LuxuryStay Hospitality</span>
        </div>
      </div>
    </div>
  );
}
