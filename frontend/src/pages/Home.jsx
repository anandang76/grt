import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Chart from '../components/Chart';
import { Loading } from '../components/ui';
import { getCandles, quote } from '../lib/candles';
import { fmtPrice } from '../lib/format';
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
  const q = quote(item.symbol);
  const cls = !q ? '' : q.ch >= 0 ? 'pos' : 'neg';
  return (
    <button className={`wl-row${active ? ' on' : ''}`} onClick={onClick}>
      <span className="wl-row-s">{item.symbol}</span>
      <span className={`wl-row-p ${cls}`}>{fmtPrice(q?.ltp)}</span>
      <span className={`wl-row-c ${cls}`}>{q ? `${q.ch >= 0 ? '▲' : '▼'} ${Math.abs(q.chp).toFixed(2)}%` : ''}</span>
    </button>
  );
}

function SymbolCharts({ symbol }) {
  const { oneMin, fiveMin } = useMemo(() => getCandles(symbol), [symbol]);
  const q = quote(symbol);
  const cls = !q ? '' : q.ch >= 0 ? 'pos' : 'neg';
  return (
    <div className="stack">
      <div className="sym-head">
        <div className="sym-id">
          <h1>{symbol}</h1>
          <span className="muted">NSE</span>
          <span className="badge b-pending" title="Simulated prices, not real market data">DEMO DATA</span>
        </div>
        {q && (
          <div className={`sym-price ${cls}`}>
            <b>{fmtPrice(q.ltp)}</b>
            <span>{q.ch >= 0 ? '+' : ''}{q.ch.toFixed(2)} ({q.chp.toFixed(2)}%)</span>
          </div>
        )}
      </div>
      <div className="card chart-card">
        <Chart bars={fiveMin} height={420} label={`${symbol} · 5m`} />
      </div>
      <div className="card chart-card">
        <Chart bars={oneMin} height={320} label={`${symbol} · 1m`} />
      </div>
    </div>
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
            <div className="wl-side-h">
              <button className="wl-collapse" onClick={toggle} title="Hide watchlist" aria-label="Hide watchlist">‹</button>
              <span>Watchlist</span>
              <Link to="/watchlist" className="wl-edit">Edit</Link>
            </div>
            <div className="wl-rows">
              {wl.map((item) => (
                <SymbolRow key={item.symbol} item={item} active={item.symbol === active} onClick={() => select(item.symbol)} />
              ))}
            </div>
          </aside>
          <section className="wl-main">
            {collapsed && (
              <button className="wl-show" onClick={toggle} aria-label="Show watchlist">☰ Watchlist</button>
            )}
            {active && <SymbolCharts symbol={active} />}
          </section>
        </div>
      )}
    </>
  );
}
