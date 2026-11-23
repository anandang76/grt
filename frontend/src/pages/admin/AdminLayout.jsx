import { NavLink, Outlet } from 'react-router-dom';
import { isSuper, useAuth } from '../../lib/auth';

export default function AdminLayout() {
  const { user } = useAuth();
  const tabs = [
    ['/admin', 'Overview', true],
    ['/admin/users', 'Users'],
    ...(isSuper(user) ? [['/admin/roles', 'Roles'], ['/admin/activity', 'Activity']] : []),
  ];
  return (
    <>
      <nav className="subnav">
        {tabs.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
