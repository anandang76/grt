import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Chart from '../components/Chart';
import { Loading } from '../components/ui';
import { getCandles, quote } from '../lib/candles';
import { fmtPrice } from '../lib/format';
import { getDhanStatus, getWatchlist } from '../lib/watchlist';

function TokenBanner() {
  const [dhan, setDhan] = useState(null);
  useEffect(() => { getDhanStatus().then((r) => setDhan(r.dhan)).catch(() => {}); }, []);
  if (!dhan || (dhan.configured && !dhan.stale)) return null;
  return (
    <div className="alert alert-info tokbar">
      <span>{dhan.configured ? "Today's Dhan token hasn't been set — live data may be unavailable." : 'No Dhan token configured yet.'}</span>
      <Link className="btn btn-sm" to="/broker">Update token</Link>
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
      <span className={`wl-row-c ${cls}`}>{q ? `${q.ch >= 0 ? '+' : ''}${q.chp.toFixed(2)}%` : ''}</span>
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
        <div>
          <h1>{symbol}</h1>
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
        <div className="chart-h"><h2>5 Min</h2><span className="muted small">UT Bot · ATR 10</span></div>
        <Chart bars={fiveMin} height={300} />
      </div>
      <div className="card chart-card">
        <div className="chart-h"><h2>1 Min</h2><span className="muted small">UT Bot · ATR 10</span></div>
        <Chart bars={oneMin} height={300} />
      </div>
    </div>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [wl, setWl] = useState(null);

  useEffect(() => { getWatchlist().then((r) => setWl(r.watchlist)).catch(() => setWl([])); }, []);

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
        <div className="terminal">
          <aside className="wl-side">
            <div className="wl-side-h">
              <span>Watchlist</span>
              <Link to="/watchlist" title="Edit watchlist" className="wl-edit">Edit</Link>
            </div>
            <div className="wl-rows">
              {wl.map((item) => (
                <SymbolRow key={item.symbol} item={item} active={item.symbol === active} onClick={() => select(item.symbol)} />
              ))}
            </div>
          </aside>
          <section className="wl-main">{active && <SymbolCharts symbol={active} />}</section>
        </div>
      )}
    </>
  );
}
