import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, isAdmin, useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { Alert, RoleBadge } from './ui';

function AccountMenu({ user }) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const ref = useRef(null);
  const loc = useLocation();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [loc.pathname]);

  const doLogout = async () => {
    await logout();
    nav('/login', { replace: true, state: { flash: { type: 'ok', msg: 'You have been logged out.' } } });
  };

  return (
    <details className="menu" ref={ref}>
      <summary aria-label="Account menu">{initials(user.name)}</summary>
      <div className="menu-pop">
        <div className="who">
          <b>{user.name}</b>
          <div className="muted small">{user.email}</div>
          <RoleBadge role={user.role} />
        </div>
        <Link to="/profile">Profile &amp; password</Link>
        <button type="button" onClick={doLogout}>Log out</button>
      </div>
    </details>
  );
}

export default function Layout({ narrow = false }) {
  const { user } = useAuth();
  const { state } = useLocation();
  const flash = state?.flash;

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <Link className="brand" to={user ? homeFor(user) : '/'}>
            <span className="logo">GR</span>
            <span>Trading</span>
          </Link>
          <nav className="nav">
            {user ? (
              <>
                {isAdmin(user) && <NavLink to="/admin">Admin</NavLink>}
                <NavLink to="/home">Terminal</NavLink>
                <AccountMenu user={user} />
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link className="btn btn-sm" to="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={`wrap${narrow ? ' narrow' : ''}`}>
        {flash && <Alert type={flash.type}>{flash.msg}</Alert>}
        <Outlet />
      </main>
      <footer>
        <div className="wrap">
          <div className="foot">
            <span>© {new Date().getFullYear()} GR Trading · <Link to="/terms">Terms</Link></span>
            <span>
              Maintained by{' '}
              <a href="https://grfintech.in" target="_blank" rel="noopener noreferrer"><b>GRFinTech</b></a>
            </span>
          </div>
          <p className="disc">Investments in the securities market are subject to market risks. Read all related documents carefully before investing.</p>
        </div>
      </footer>
    </>
  );
}
