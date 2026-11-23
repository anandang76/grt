import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../lib/auth';

/** Signed-in only; optional role list. Forces /profile while a password change is required. */
export function RequireAuth({ roles }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.must_change_password && loc.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ flash: { type: 'info', msg: 'Please set a new password to continue.' } }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** Guests only (login, signup, forgot). */
export function GuestOnly() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />;
}
