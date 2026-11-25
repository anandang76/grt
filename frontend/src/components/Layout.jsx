import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, isAdmin, useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { RoleBadge } from './ui';

// Auto-dismissing toast for one-off flash messages set via navigation state.
function FlashToast() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const timer = useRef();

  useEffect(() => {
    const f = loc.state?.flash;
    if (!f) return;
    setToast({ ...f, id: Date.now() });
    navigate(loc.pathname + loc.search, { replace: true, state: {} }); // don't re-show on refresh/back
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 12000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} role="status">
      <span>{toast.msg}</span>
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">✕</button>
    </div>
  );
}

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
        <Link to="/watchlist">Configure watchlist</Link>
        <Link to="/broker">Dhan API token</Link>
        <Link to="/profile">Profile &amp; password</Link>
        <button type="button" onClick={doLogout}>Log out</button>
      </div>
    </details>
  );
}

export default function Layout({ narrow = false, full = false, bare = false }) {
  const { user } = useAuth();

  // Bare layout: no top header/footer — used by the terminal, which puts nav in its left sidebar.
  if (bare) {
    return (
      <>
        <FlashToast />
        <main className="wrap wrap-full bare-main"><Outlet /></main>
      </>
    );
  }

  return (
    <>
      <FlashToast />
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
      <main className={`wrap${narrow ? ' narrow' : ''}${full ? ' wrap-full' : ''}`}>
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
