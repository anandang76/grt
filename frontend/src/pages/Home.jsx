import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import Chart from '../components/Chart';
import { Loading } from '../components/ui';
import { useLiveCandles } from '../hooks/useLiveCandles';
import { quote } from '../lib/candles';
import { isAdmin, useAuth } from '../lib/auth';
import { fmtPrice, initials } from '../lib/format';
import { marketOpen } from '../lib/market';
import { getDhanStatus, getWatchlist } from '../lib/watchlist';

const COLLAPSE_KEY = 'grt_wl_collapsed';

function TokenBanner() {
  const [dhan, setDhan] = useState(null);
  useEffect(() => { getDhanStatus().then((r) => setDhan(r.dhan)).catch(() => {}); }, []);
  if (!dhan || dhan.ready) return null;
  const msg = !dhan.client_id
    ? 'Dhan Client ID not set — live data is unavailable.'
    : !dhan.token_set
      ? 'No Dhan access token set — live data is unavailable.'
      : "Today's Dhan token hasn't been set — live data may be unavailable.";
  return (
    <div className="alert alert-info tokbar">
      <span>{msg}</span>
      <Link className="btn btn-sm" to="/broker">Update Dhan</Link>
    </div>
  );
}

function SymbolRow({ item, active, onClick }) {
  // Real LTP + day % from the API; demo-only symbols fall back to the client generator.
  const q = item.ltp != null ? { ltp: Number(item.ltp), chp: Number(item.chp) || 0 } : quote(item.symbol);
  const cls = !q ? '' : q.chp >= 0 ? 'pos' : 'neg';
  return (
    <button className={`wl-row${active ? ' on' : ''}`} onClick={onClick}>
      <span className="wl-row-s">{item.symbol}<span className={`exch exch-${(item.exchange || 'nse').toLowerCase()}`}>{item.exchange || 'NSE'}</span></span>
      <span className={`wl-row-p ${cls}`}>{fmtPrice(q?.ltp)}</span>
      <span className={`wl-row-c ${cls}`}>{q ? `${q.chp >= 0 ? '▲' : '▼'} ${Math.abs(q.chp).toFixed(2)}%` : ''}</span>
    </button>
  );
}

function useChartHeight() {
  const calc = () => Math.max(320, Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.86));
  const [h, setH] = useState(calc);
  useEffect(() => {
    let t;
    const on = () => { clearTimeout(t); t = setTimeout(() => setH(calc()), 150); };
    window.addEventListener('resize', on);
    return () => { clearTimeout(t); window.removeEventListener('resize', on); };
  }, []);
  return h;
}

function SymbolCharts({ symbol, kind, live }) {
  const { oneMin, fiveMin } = useLiveCandles(symbol, kind);
  const h = useChartHeight();
  const [solo, setSolo] = useState(null); // null = both side-by-side; '1m' | '5m' = expanded
  const tag = live ? '' : 'DEMO';
  const toggle = (tf) => setSolo((v) => (v === tf ? null : tf));

  return (
    <div className={`charts-row${solo ? ' solo' : ''}`}>
      {(!solo || solo === '1m') && (
        <div className="card chart-card">
          <Chart bars={oneMin} height={h} label={`${symbol} · 1m`} tag={tag} expanded={solo === '1m'} onToggleExpand={() => toggle('1m')} />
        </div>
      )}
      {(!solo || solo === '5m') && (
        <div className="card chart-card">
          <Chart bars={fiveMin} height={h} label={`${symbol} · 5m`} tag={tag} expanded={solo === '5m'} onToggleExpand={() => toggle('5m')} />
        </div>
      )}
    </div>
  );
}

// Navigation moved into the sidebar (the top header is hidden on the terminal for more chart space).
function SidebarNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); nav('/login', { replace: true, state: { flash: { type: 'ok', msg: 'You have been logged out.' } } }); };
  return (
    <nav className="wl-nav">
      {isAdmin(user) && <NavLink to="/admin">Admin panel</NavLink>}
      <NavLink to="/watchlist">Configure watchlist</NavLink>
      <NavLink to="/broker">Dhan API token</NavLink>
      <NavLink to="/profile">Profile &amp; password</NavLink>
      <button type="button" onClick={doLogout}>Log out</button>
      <div className="wl-who"><span className="wl-ava">{initials(user.name)}</span><span className="small muted">{user.email}</span></div>
    </nav>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [wl, setWl] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => { getWatchlist().then((r) => setWl(r.watchlist)).catch(() => setWl([])); }, []);

  const toggle = () => setCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const selected = params.get('s');
  const active = wl?.some((w) => w.symbol === selected) ? selected : wl?.[0]?.symbol;
  const activeItem = wl?.find((w) => w.symbol === active);
  const status = activeItem && marketOpen(activeItem.kind) ? 'live' : 'offline';
  const select = (sym) => setParams((p) => { p.set('s', sym); return p; }, { replace: true });

  if (wl === null) return <Loading />;

  return (
    <>
      <TokenBanner />
      {wl.length === 0 ? (
        <div className="card center auth">
          <h1>Your watchlist is empty</h1>
          <p className="sub">Pick up to 10 NIFTY 50 stocks to see their 1-min and 5-min charts with buy/sell signals.</p>
          <Link className="btn" to="/watchlist">Choose stocks</Link>
        </div>
      ) : (
        <div className={`terminal${collapsed ? ' collapsed' : ''}`}>
          <aside className="wl-side">
            <Link className="wl-brand" to="/home"><span className="logo">GR</span><span>Trading</span></Link>
            <div className="wl-side-h">
              <button className="wl-collapse" onClick={toggle} title="Hide watchlist" aria-label="Hide watchlist">‹</button>
              <span>Watchlist</span>
              <span className={`live-dot live-${status}`} title={status === 'live' ? 'Market open' : 'Market closed'} />
              <Link to="/watchlist" className="wl-edit">Edit</Link>
            </div>
            <div className="wl-rows">
              {wl.map((item) => (
                <SymbolRow key={item.symbol} item={item} active={item.symbol === active} onClick={() => select(item.symbol)} />
              ))}
            </div>
            <SidebarNav />
          </aside>
          <section className="wl-main">
            {collapsed && (
              <button className="wl-show" onClick={toggle} aria-label="Show watchlist">☰ Watchlist</button>
            )}
            {active && <SymbolCharts key={active} symbol={active} kind={activeItem?.kind} live={activeItem?.live} />}
          </section>
        </div>
      )}
    </>
  );
}
