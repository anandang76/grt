import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/ui';
import { useOptionFeed } from '../hooks/useOptionFeed';
import { optKey } from '../lib/options';
import { bestBid, getPositions, squareOff } from '../lib/paper';
import { fmtPrice } from '../lib/format';

const exchOf = (seg) => (seg === 'BSE_FNO' ? 'BSE' : seg === 'MCX_COMM' ? 'MCX' : 'NSE');
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (v) => (v == null ? '—' : nf.format(v));
const signed = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${nf.format(Math.abs(v))}`);
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

export default function Positions() {
  const [data, setData] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => getPositions().then(setData).catch(() => setData({ positions: [] })), []);
  useEffect(() => { load(); }, [load]);

  const positions = data?.positions || [];
  const open = positions.filter((p) => p.status === 'open');
  const closed = positions.filter((p) => p.status === 'closed');

  const sig = open.map((p) => p.security_id).join(',');
  const instruments = useMemo(() => open.map((p) => ({ key: optKey(p.security_id), segment: p.segment, securityId: p.security_id })), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ticks, depth } = useOptionFeed(instruments);

  const liveOf = (p) => {
    const d = depth[optKey(p.security_id)];
    const ltp = ticks[optKey(p.security_id)]?.ltp ?? d?.ltp ?? null;
    const sell = bestBid(d);                                   // the bid you'd actually sell into
    return {
      ltp,
      sell,
      ltpVal: ltp != null ? ltp * p.qty : null,
      sellVal: sell != null ? sell * p.qty : null,
      pnl: sell != null ? (sell - p.avg_price) * p.qty : null,
    };
  };

  const square = async (p) => {
    const { sell, ltp } = liveOf(p);
    const price = sell ?? ltp;
    if (price == null) { window.alert('No live price yet — wait for the depth to stream.'); return; }
    if (!window.confirm(`Square off ${p.dhan_symbol} — sell ${p.qty} @ ${fmtPrice(price)} (bid)?`)) return;
    setBusyId(p.id);
    try { await squareOff(p.id, price); await load(); } catch { /* ignore */ }
    setBusyId(null);
  };

  if (data === null) return <Loading />;

  const live = open.map((p) => ({ p, l: liveOf(p) }));
  const tot = live.reduce((a, { p, l }) => ({
    bought: a.bought + p.bought_value,
    ltpVal: a.ltpVal + (l.ltpVal || 0),
    sellVal: a.sellVal + (l.sellVal || 0),
    pnl: a.pnl + (l.pnl || 0),
  }), { bought: 0, ltpVal: 0, sellVal: 0, pnl: 0 });
  const realized = closed.reduce((a, p) => a + (p.realized_pnl || 0), 0);

  return (
    <div className="card pos-page">
      <div className="pos-head">
        <h1>Paper positions</h1>
        <div className="pos-head-r">
          <button type="button" className="btn btn-sm btn-line" onClick={load}>↻ Refresh</button>
          <Link className="btn btn-sm btn-line" to="/home">Terminal</Link>
        </div>
      </div>
      <p className="sub">Long CE/PE only. Buy fills at the ask; squaring off sells at the bid. P&amp;L uses the live bid — the LTP and the executable sell price often differ.</p>

      <div className="pos-summary">
        <div><span className="muted">Open P&amp;L (live)</span><b className={tot.pnl >= 0 ? 'pos' : 'neg'}>{open.length ? signed(tot.pnl) : '—'}</b></div>
        <div><span className="muted">LTP value (total)</span><b>{open.length ? money(tot.ltpVal) : '—'}</b></div>
        <div><span className="muted">Sell value (total)</span><b className="sell-px">{open.length ? money(tot.sellVal) : '—'}</b></div>
        <div><span className="muted">Bought (total)</span><b>{open.length ? money(tot.bought) : '—'}</b></div>
        <div><span className="muted">Realized</span><b className={realized >= 0 ? 'pos' : 'neg'}>{closed.length ? signed(realized) : '—'}</b></div>
      </div>

      <h2 className="pos-h2">Open · {open.length}</h2>
      {open.length === 0 ? <div className="empty">No open positions. Buy a CE/PE from the option ladder on the terminal.</div> : (
        <div className="pos-scroll">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Symbol</th><th className="num">Qty</th><th className="num">Avg</th><th className="num">Bought</th>
                <th className="num">LTP</th><th className="num">LTP value</th>
                <th className="num">Sell (bid)</th><th className="num">Sell value</th>
                <th className="num">P&amp;L</th><th className="acts"></th>
              </tr>
            </thead>
            <tbody>
              {live.map(({ p, l }) => (
                <Fragment key={p.id}>
                  <tr>
                    <td className="sym"><b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b><span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span></td>
                    <td className="num">{p.qty}</td>
                    <td className="num">{fmtPrice(p.avg_price)}</td>
                    <td className="num">{money(p.bought_value)}</td>
                    <td className="num">{l.ltp != null ? fmtPrice(l.ltp) : '—'}</td>
                    <td className="num">{money(l.ltpVal)}</td>
                    <td className="num sell-px">{l.sell != null ? fmtPrice(l.sell) : '—'}</td>
                    <td className="num sell-px">{money(l.sellVal)}</td>
                    <td className={`num ${l.pnl == null ? '' : l.pnl >= 0 ? 'pos' : 'neg'}`}>{signed(l.pnl)}</td>
                    <td className="acts">
                      <button type="button" className="btn btn-xs btn-line" onClick={() => setViewId(viewId === p.id ? null : p.id)}>{viewId === p.id ? 'Hide' : 'View'}</button>
                      <button type="button" className="btn btn-xs btn-danger" disabled={busyId === p.id} onClick={() => square(p)}>{busyId === p.id ? '…' : 'Square'}</button>
                    </td>
                  </tr>
                  {viewId === p.id && (
                    <tr className="pos-fills-row">
                      <td colSpan={10}>
                        <div className="pos-fills">
                          <span className="muted small">Opened {fmtWhen(p.opened_at)} · fills:</span>
                          {(p.fills || []).map((f, i) => (
                            <span className="pos-fill" key={i}><span className="tag">{f.stage}</span>{f.qty} @ {fmtPrice(f.price)} <span className="muted">({fmtWhen(f.at)})</span></span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="pos-tot">
                <td>Total</td><td className="num">{open.reduce((a, p) => a + p.qty, 0)}</td><td></td>
                <td className="num">{money(tot.bought)}</td><td></td>
                <td className="num">{money(tot.ltpVal)}</td><td></td>
                <td className="num sell-px">{money(tot.sellVal)}</td>
                <td className={`num ${tot.pnl >= 0 ? 'pos' : 'neg'}`}>{signed(tot.pnl)}</td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="pos-h2">Closed · {closed.length}</h2>
          <div className="pos-scroll">
            <table className="pos-table">
              <thead>
                <tr><th>Symbol</th><th className="num">Qty</th><th className="num">Avg</th><th className="num">Exit</th><th className="num">Realized</th><th className="num">Closed</th></tr>
              </thead>
              <tbody>
                {closed.map((p) => (
                  <tr key={p.id}>
                    <td className="sym"><b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b><span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span></td>
                    <td className="num">{p.qty}</td>
                    <td className="num">{fmtPrice(p.avg_price)}</td>
                    <td className="num">{fmtPrice(p.exit_price)}</td>
                    <td className={`num ${(p.realized_pnl || 0) >= 0 ? 'pos' : 'neg'}`}>{signed(p.realized_pnl)}</td>
                    <td className="num">{fmtWhen(p.closed_at)}</td>
                  </tr>
                ))}
                <tr className="pos-tot"><td>Total</td><td></td><td></td><td></td><td className={`num ${realized >= 0 ? 'pos' : 'neg'}`}>{signed(realized)}</td><td></td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
