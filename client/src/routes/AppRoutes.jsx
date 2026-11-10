import GuestPage from '../pages/public/GuestPage.jsx';
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import RoleRoute from './RoleRoute.jsx';
import Loader from '../components/Loader.jsx';

const Home = lazy(() => import('../pages/public/Home.jsx'));
const Login = lazy(() => import('../pages/public/Login.jsx'));
const Register = lazy(() => import('../pages/public/Register.jsx'));
const NotFound = lazy(() => import('../pages/public/NotFound.jsx'));
const Unauthorized = lazy(() => import('../pages/public/Unauthorized.jsx'));
const UserLayout = lazy(() => import('../layouts/UserLayout.jsx'));
const UserDashboard = lazy(() => import('../pages/user/UserDashboard.jsx'));
const BrowseCategories = lazy(() => import('../pages/user/BrowseCategories.jsx'));
const Profile = lazy(() => import('../pages/user/Profile.jsx'));
const AdminLayout = lazy(() => import('../layouts/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard.jsx'));
const ManageCategories = lazy(() => import('../pages/admin/ManageCategories.jsx'));
const ManageUsers = lazy(() => import('../pages/admin/ManageUsers.jsx'));
const ManageMedia = lazy(() => import('../pages/admin/ManageMedia.jsx'));
const BrowseMedia = lazy(() => import('../pages/user/BrowseMedia.jsx'));
const AccountLink = lazy(() => import('../pages/public/AccountLink.jsx'));
const ActivityLog = lazy(() => import('../pages/admin/ActivityLog.jsx'));
const HotelManagement = lazy(() => import('../pages/admin/HotelManagement.jsx'));
const HmsOperations = lazy(() => import('../pages/hms/HmsOperations.jsx'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          {['stays', 'about', 'services', 'features', 'help', 'contact'].map((page) => (
            <Route key={page} path={page} element={<GuestPage page={page} />} />
          ))}
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<AccountLink key="forgot" mode="forgot" />} />
          <Route path="reset-password" element={<AccountLink key="reset" mode="reset" />} />
          <Route path="verify-email" element={<AccountLink key="verify" mode="verify" />} />
          <Route path="unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute role="admin" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="categories" element={<ManageCategories />} />
              <Route path="users" element={<ManageUsers />} />
              <Route path="hotels" element={<HotelManagement key="hotels" />} />
              <Route path="staff" element={<HotelManagement key="staff" staff />} />
              <Route path="operations" element={<HmsOperations />} />
              <Route path="media" element={<ManageMedia />} />
              <Route path="profile" element={<Profile />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route
            element={
              <RoleRoute
                role={['user', 'manager', 'receptionist', 'housekeeping', 'maintenance']}
              />
            }
          >
            <Route path="user" element={<UserLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<UserDashboard />} />
              <Route path="operations" element={<HmsOperations />} />
              <Route element={<RoleRoute role="user" />}>
                {['reservations', 'stays', 'services', 'billing', 'feedback'].map((tab) => (
                  <Route
                    key={tab}
                    path={tab}
                    element={<HmsOperations key={tab} initialTab={tab} />}
                  />
                ))}
              </Route>
              <Route
                element={
                  <RoleRoute role={['manager', 'receptionist', 'housekeeping', 'maintenance']} />
                }
              >
                <Route path="hotels" element={<HotelManagement key="hotels" />} />
              </Route>
              <Route element={<RoleRoute role="manager" />}>
                <Route path="staff" element={<HotelManagement key="staff" staff />} />
              </Route>
              <Route path="categories" element={<BrowseCategories />} />
              <Route path="profile" element={<Profile />} />
              <Route path="media" element={<BrowseMedia />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
