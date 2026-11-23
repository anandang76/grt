import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';
import { homeFor, isAdmin, useAuth } from '../lib/auth';

const FEATURES = [
  ['Built for speed', 'Lightweight pages with no bloat. Loads fast even on slow mobile networks.', <path key="a" d="M13 2 3 14h9l-1 8 10-12h-9z" />],
  ['Mobile first', 'Designed for your phone first, and it scales up neatly to a desktop terminal.', <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>],
  ['Secure access', 'Log in with a password, a one-time code sent to your email, or your Google account.', <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>],
  ['Live market data', 'Streaming prices from established Indian broker platforms, with orders placed through them.', <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <>
      <section className="hero">
        <div>
          <span className="pill">BY GR FINTECH</span>
          <h1>Trade with <em>speed</em> and clarity.</h1>
          <p>GR Trading is a fast, minimal trading terminal for Indian markets. Stocks, F&amp;O and more, built to load instantly on any phone or desktop.</p>
          <div className="cta">
            {user ? (
              <Link className="btn" to={homeFor(user)}>Open {isAdmin(user) ? 'admin panel' : 'terminal'} →</Link>
            ) : (
              <>
                <Link className="btn" to="/signup">Open an account</Link>
                <Link className="btn btn-line" to="/login">Log in</Link>
              </>
            )}
          </div>
        </div>
        <div className="card art" aria-hidden="true">
          <div className="art-h"><b>Market overview</b><span className="small muted">Illustration</span></div>
          <svg viewBox="0 0 320 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
                <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 120 L25 112 L50 116 L75 96 L100 100 L125 82 L150 88 L175 64 L200 70 L225 50 L250 58 L275 36 L300 42 L320 24 L320 150 L0 150Z" fill="url(#g)" />
            <path d="M0 120 L25 112 L50 116 L75 96 L100 100 L125 82 L150 88 L175 64 L200 70 L225 50 L250 58 L275 36 L300 42 L320 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      <section>
        <div className="grid">
          {FEATURES.map(([title, text, icon]) => (
            <div className="card feat" key={title}>
              <div className="ico"><Icon d={icon} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {!user && (
        <section className="card band">
          <div>
            <h2 style={{ margin: 0 }}>Ready to start?</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Sign up in a minute. An admin approves new accounts before first login.</p>
          </div>
          <Link className="btn" to="/signup">Create account</Link>
        </section>
      )}
    </>
  );
}
