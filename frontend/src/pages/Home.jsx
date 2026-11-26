import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import Chart from '../components/Chart';
import OptionLadder from '../components/OptionLadder';
import { Loading } from '../components/ui';
import { useLiveCandles } from '../hooks/useLiveCandles';
import { useTicker } from '../hooks/useTicker';
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
    ? 'Dhan Client ID not set — showing stored history only.'
    : !dhan.token_set
      ? 'No Dhan access token set — showing stored history only.'
      : 'Dhan token expired — live data paused, showing stored history. Update the token to resume.';
  return (
    <div className="alert alert-info tokbar">
      <span>{msg}</span>
      <Link className="btn btn-sm" to="/broker">Update Dhan</Link>
    </div>
  );
}

function SymbolRow({ item, liveLtp, active, onClick }) {
  // Live LTP from the websocket when present; else stored daily; else demo.
  const ltp = liveLtp ?? (item.ltp != null ? Number(item.ltp) : null);
  const q = ltp != null ? { ltp, chp: Number(item.chp) || 0 } : quote(item.symbol);
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
  const calc = () => Math.max(300, Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.62));
  const [h, setH] = useState(calc);
  useEffect(() => {
    let t;
    const on = () => { clearTimeout(t); t = setTimeout(() => setH(calc()), 150); };
    window.addEventListener('resize', on);
    return () => { clearTimeout(t); window.removeEventListener('resize', on); };
  }, []);
  return h;
}

// Combine the latest 1-min and 5-min UT Bot positions (1 = long, -1 = short) into one call.
function combineSignal(p1, p5) {
  if (p1 > 0 && p5 > 0) return { level: 'strong-buy', text: 'STRONG BUY', dir: 'up' };
  if (p1 < 0 && p5 < 0) return { level: 'strong-sell', text: 'STRONG SELL', dir: 'down' };
  if (p1 > 0 && p5 < 0) return { level: 'buy-caution', text: 'BUY · CAUTION', dir: 'up' };
  if (p1 < 0 && p5 > 0) return { level: 'sell-caution', text: 'SELL · CAUTION', dir: 'down' };
  return { level: 'neutral', text: 'NEUTRAL', dir: 'flat' };
}

function SignalBadge({ p1, p5 }) {
  const s = combineSignal(p1, p5);
  const arrow = s.dir === 'up' ? 'M12 19V5M5 12l7-7 7 7' : s.dir === 'down' ? 'M12 5v14M5 12l7 7 7-7' : 'M5 12h14';
  const mark = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '–');
  const [pos, setPos] = useState(() => { try { return JSON.parse(localStorage.getItem('grt_sig_pos')) || { x: 12, y: 150 }; } catch { return { x: 12, y: 150 }; } });
  const drag = useRef(null);

  const onDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev) => setPos({ x: Math.max(0, drag.current.ox + ev.clientX - drag.current.sx), y: Math.max(0, drag.current.oy + ev.clientY - drag.current.sy) });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPos((p) => { try { localStorage.setItem('grt_sig_pos', JSON.stringify(p)); } catch { /* ignore */ } return p; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className={`signal-badge sig-${s.level}`} style={{ left: pos.x, top: pos.y }} onPointerDown={onDown} title="Drag to move · combined 1m + 5m signal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={arrow} /></svg>
      <div className="sig-txt">{s.text}</div>
      <div className="sig-sub"><span className={p1 >= 0 ? 'pos' : 'neg'}>1m {mark(p1)}</span><span className={p5 >= 0 ? 'pos' : 'neg'}>5m {mark(p5)}</span></div>
    </div>
  );
}

function SymbolCharts({ symbol, kind, tick, live }) {
  const { oneMin, fiveMin, refresh, refreshing } = useLiveCandles(symbol, kind, tick);
  const h = useChartHeight();
  const [solo, setSolo] = useState(null); // null = both side-by-side; '1m' | '5m' = expanded
  const tag = live ? '' : 'DEMO';
  const toggle = (tf) => setSolo((v) => (v === tf ? null : tf));
  const p1 = oneMin.at(-1)?.ut_bot_position ?? 0;
  const p5 = fiveMin.at(-1)?.ut_bot_position ?? 0;

  return (
    <div className="charts-wrap">
      <div className="charts-top">
        <span className="charts-top-sym">{symbol} <span className={`exch exch-${(live === false ? 'nse' : kind === 'commodity' ? 'mcx' : 'nse')}`}>{kind === 'commodity' ? 'MCX' : kind === 'index' ? 'IDX' : 'NSE'}</span></span>
        <button className="btn btn-sm btn-line" onClick={refresh} disabled={refreshing} title="Clear today & re-pull per-minute data from Dhan">
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      {oneMin.length > 0 && <SignalBadge p1={p1} p5={p5} />}
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
      {oneMin.length > 0 && (() => {
        const combo = combineSignal(p1, p5);
        const hotDir = combo.level === 'strong-buy' ? 'up' : combo.level === 'strong-sell' ? 'down' : 'flat';
        return <OptionLadder symbol={symbol} spot={tick?.ltp ?? oneMin.at(-1)?.close} dir={hotDir} />;
      })()}
    </div>
  );
}

// Navigation moved into the sidebar (the top header is hidden on the terminal for more chart space).
// Collapsed by default — the account row toggles the menu open/closed.
function SidebarNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const doLogout = async () => { await logout(); nav('/login', { replace: true, state: { flash: { type: 'ok', msg: 'You have been logged out.' } } }); };
  const close = () => setOpen(false);
  return (
    <nav className={`wl-nav${open ? ' open' : ''}`}>
      {open && (
        <div className="wl-nav-links">
          {isAdmin(user) && <NavLink to="/admin" onClick={close}>Admin panel</NavLink>}
          <NavLink to="/watchlist" onClick={close}>Configure watchlist</NavLink>
          <NavLink to="/positions" onClick={close}>Paper positions</NavLink>
          <NavLink to="/broker" onClick={close}>Dhan API token</NavLink>
          <NavLink to="/profile" onClick={close}>Profile &amp; password</NavLink>
          <button type="button" onClick={doLogout}>Log out</button>
        </div>
      )}
      <button type="button" className="wl-who" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="wl-ava">{initials(user.name)}</span>
        <span className="small muted">{user.email}</span>
        <span className="wl-who-chev">{open ? '▾' : '▸'}</span>
      </button>
    </nav>
  );
}

// Collapsible sidebar section. Shrinking the watchlist reveals the panels below it.
function Panel({ title, extra, storageKey, defaultOpen = true, children }) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try { const v = localStorage.getItem(storageKey); return v === null ? defaultOpen : v === '1'; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen((o) => { const n = !o; try { if (storageKey) localStorage.setItem(storageKey, n ? '1' : '0'); } catch { /* ignore */ } return n; });
  return (
    <div className={`side-panel${open ? ' open' : ''}`}>
      <div className="side-panel-h" onClick={toggle} role="button" tabIndex={0}>
        <span className="side-panel-chev">{open ? '▾' : '▸'}</span>
        <span className="side-panel-title">{title}</span>
        {extra && <span className="side-panel-extra" onClick={(e) => e.stopPropagation()}>{extra}</span>}
      </div>
      {open && <div className="side-panel-body">{children}</div>}
    </div>
  );
}

const PanelPlaceholder = ({ hint }) => <div className="panel-ph">{hint}<span className="soon">SOON</span></div>;

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [wl, setWl] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [wlOnly, setWlOnly] = useState(() => {
    try { return localStorage.getItem('grt_wl_only') === '1'; } catch { return false; }
  });
  const toggleWlOnly = () => setWlOnly((v) => {
    const n = !v;
    try { localStorage.setItem('grt_wl_only', n ? '1' : '0'); } catch { /* ignore */ }
    return n;
  });

  useEffect(() => { getWatchlist().then((r) => setWl(r.watchlist)).catch(() => setWl([])); }, []);

  const symbols = wl ? wl.map((w) => w.symbol) : [];
  const { ticks } = useTicker(symbols);

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
            <div className="wl-top">
              <Link className="wl-brand" to="/home"><span className="logo">GR</span><span>Trading</span></Link>
              <button className="wl-collapse" onClick={toggle} title="Hide panel" aria-label="Hide panel">‹</button>
            </div>
            <div className="wl-panels">
              <Panel
                title="Watchlist"
                storageKey="grt_p_watchlist"
                extra={<>
                  <button type="button" className="wl-shrink" onClick={toggleWlOnly} title={wlOnly ? 'Show all symbols' : 'Collapse to selected only'} aria-label="Toggle watchlist size">{wlOnly ? '▾' : '▴'}</button>
                  <span className={`live-dot live-${status}`} title={status === 'live' ? 'Market open' : 'Market closed'} />
                  <Link to="/watchlist" className="wl-edit">Edit</Link>
                </>}
              >
                <div className="wl-rows">
                  {(wlOnly && active ? wl.filter((w) => w.symbol === active) : wl).map((item) => (
                    <SymbolRow key={item.symbol} item={item} liveLtp={ticks[item.symbol]?.ltp} active={item.symbol === active} onClick={() => select(item.symbol)} />
                  ))}
                  {wlOnly && wl.length > 1 && (
                    <button type="button" className="wl-more" onClick={toggleWlOnly}>▾ Show all {wl.length}</button>
                  )}
                </div>
              </Panel>
              <Panel title="Positions" storageKey="grt_p_positions" defaultOpen={false}>
                <Link to="/positions" className="panel-link">Open paper positions &amp; P&amp;L →</Link>
              </Panel>
              <Panel title="Orders" storageKey="grt_p_orders" defaultOpen={false}><PanelPlaceholder hint="Order book" /></Panel>
              <Panel title="Holdings" storageKey="grt_p_holdings" defaultOpen={false}><PanelPlaceholder hint="Portfolio holdings" /></Panel>
            </div>
            <SidebarNav />
          </aside>
          <section className="wl-main">
            {collapsed && (
              <button className="wl-show" onClick={toggle} aria-label="Show watchlist">☰ Watchlist</button>
            )}
            {active && <SymbolCharts key={active} symbol={active} kind={activeItem?.kind} tick={ticks[active]} live={activeItem?.live} />}
          </section>
        </div>
      )}
    </>
  );
}
