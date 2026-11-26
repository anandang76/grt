import { NavLink, Outlet } from 'react-router-dom';
import { isSuper, useAuth } from '../../lib/auth';

export default function AdminLayout() {
  const { user } = useAuth();
  const tabs = [
    ['/admin', 'Overview', true],
    ['/admin/master-list', 'Master list'],
    ['/admin/users', 'Users'],
    ['/admin/history', 'History data'],
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
