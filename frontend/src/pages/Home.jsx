import { Link } from 'react-router-dom';
import { Icon, RoleBadge } from '../components/ui';
import { useTicker } from '../hooks/useTicker';
import { isAdmin, useAuth } from '../lib/auth';
import { fmtPrice } from '../lib/format';

const WATCH = ['NIFTY 50', 'NIFTY BANK', 'SENSEX', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];

const TILES = [
  ['Orders', 'Place and track orders', <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>],
  ['Positions', 'Open positions and P&L', <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>],
  ['Holdings', 'Long-term portfolio', <><path d="M21 16V8l-9-5-9 5v8l9 5z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>],
  ['Funds', 'Margins and balances', <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /></>],
];

function MarketWatch() {
  const { ticks, status, demo } = useTicker(WATCH);
  return (
    <div className="card tcard">
      <div className="tcard-h">
        <h2>Market watch</h2>
        <span className="small">
          {demo && <span className="badge b-pending" title="Simulated prices, not real market data">DEMO DATA</span>}{' '}
          <span className={`dot dot-${status}`} /> {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
        </span>
      </div>
      <ul className="mw">
        {WATCH.map((s) => {
          const t = ticks[s];
          const cls = !t ? '' : t.ch >= 0 ? 'pos' : 'neg';
          return (
            <li key={s}>
              <span className="mw-s">{s}</span>
              <span className={`mw-p ${cls}`}>{fmtPrice(t?.ltp)}</span>
              <span className={`mw-c ${cls}`}>{t ? `${t.ch >= 0 ? '+' : ''}${t.chp.toFixed(2)}%` : '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const first = user.name.trim().split(/\s+/)[0];

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Hi, {first} 👋</h1>
          <p className="muted" style={{ margin: 0 }}>Welcome to your GR Trading terminal.</p>
        </div>
        {isAdmin(user) && <Link className="btn btn-line btn-sm" to="/admin">Admin panel →</Link>}
      </div>

      <div className="two">
        <MarketWatch />
        <div className="stack">
          <div className="tiles tiles-2">
            {TILES.map(([t, d, icon]) => (
              <div className="card tile" key={t}>
                <div className="ico"><Icon d={icon} /></div>
                <h3>{t} <span className="soon">SOON</span></h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Your account</h2>
            <dl className="kv">
              <dt>Name</dt><dd>{user.name}</dd>
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Mobile</dt><dd>{user.phone || '—'}</dd>
              <dt>Role</dt><dd><RoleBadge role={user.role} /></dd>
            </dl>
            <p style={{ margin: '14px 0 0' }}><Link to="/profile">Change password →</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}
