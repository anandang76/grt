import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/ui';
import { useOptionFeed } from '../hooks/useOptionFeed';
import { optKey } from '../lib/options';
import { bestBid, getPositions, squareOff } from '../lib/paper';
import { fmtPrice } from '../lib/format';

const exchOf = (seg) => (seg === 'BSE_FNO' ? 'BSE' : seg === 'MCX_COMM' ? 'MCX' : 'NSE');
const signed = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${fmtPrice(Math.abs(v))}`);
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

  // Live depth for open positions only (LTP + the bid you'd actually sell into).
  const sig = open.map((p) => p.security_id).join(',');
  const instruments = useMemo(() => open.map((p) => ({ key: optKey(p.security_id), segment: p.segment, securityId: p.security_id })), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ticks, depth } = useOptionFeed(instruments);

  const liveOf = (p) => {
    const d = depth[optKey(p.security_id)];
    const ltp = ticks[optKey(p.security_id)]?.ltp ?? d?.ltp ?? null;
    const sell = bestBid(d);                              // what you'd receive squaring off now
    const pnl = sell != null ? (sell - p.avg_price) * p.qty : null;
    return { ltp, sell, pnl };
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

  const openPnl = open.reduce((a, p) => a + (liveOf(p).pnl || 0), 0);
  const realized = closed.reduce((a, p) => a + (p.realized_pnl || 0), 0);

  return (
    <div className="card">
      <div className="pos-head">
        <h1>Paper positions</h1>
        <Link className="btn btn-sm btn-line" to="/home">Back to terminal</Link>
      </div>
      <p className="sub">Long CE/PE only. Buy fills at the ask; squaring off sells at the bid. The LTP and the sell (bid) often differ — P&amp;L uses the bid you’d actually get.</p>

      <div className="pos-summary">
        <div><span className="muted">Open P&amp;L (live)</span><b className={openPnl >= 0 ? 'pos' : 'neg'}>{open.length ? signed(openPnl) : '—'}</b></div>
        <div><span className="muted">Realized</span><b className={realized >= 0 ? 'pos' : 'neg'}>{closed.length ? signed(realized) : '—'}</b></div>
        <div><span className="muted">Open / Closed</span><b>{open.length} / {closed.length}</b></div>
      </div>

      <h2 className="pos-h2">Open</h2>
      {open.length === 0 ? <div className="empty">No open positions. Buy a CE/PE from the option ladder on the terminal.</div> : (
        <div className="pos-list">
          {open.map((p) => {
            const { ltp, sell, pnl } = liveOf(p);
            return (
              <div className="pos-card" key={p.id}>
                <div className="pos-row">
                  <div className="pos-sym">
                    <b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b>
                    <span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span>
                  </div>
                  <div className="pos-pnl"><span className="muted">P&amp;L</span><b className={pnl == null ? '' : pnl >= 0 ? 'pos' : 'neg'}>{pnl == null ? '—' : signed(pnl)}</b></div>
                </div>
                <div className="pos-grid">
                  <div><span>Qty</span><b>{p.qty}</b></div>
                  <div><span>Avg buy</span><b>{fmtPrice(p.avg_price)}</b></div>
                  <div><span>Bought</span><b>{fmtPrice(p.bought_value)}</b></div>
                  <div><span>LTP</span><b>{ltp != null ? fmtPrice(ltp) : '—'}</b></div>
                  <div><span>Sell (bid)</span><b className="sell-px">{sell != null ? fmtPrice(sell) : '—'}</b></div>
                  <div><span>Stages</span><b>{(p.stages_done || []).join(' · ') || '—'}</b></div>
                </div>
                <div className="pos-actions">
                  <button type="button" className="btn btn-sm btn-line" onClick={() => setViewId(viewId === p.id ? null : p.id)}>{viewId === p.id ? 'Hide' : 'View'}</button>
                  <button type="button" className="btn btn-sm btn-danger" disabled={busyId === p.id} onClick={() => square(p)}>{busyId === p.id ? 'Squaring…' : 'Square off'}</button>
                </div>
                {viewId === p.id && (
                  <div className="pos-fills">
                    <div className="muted small">Fills · opened {fmtWhen(p.opened_at)}</div>
                    {(p.fills || []).map((f, i) => (
                      <div className="pos-fill" key={i}><span className="tag">{f.stage}</span><span>{f.qty} @ {fmtPrice(f.price)}</span><span className="muted">{fmtWhen(f.at)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="pos-h2">Closed</h2>
          <div className="pos-list">
            {closed.map((p) => (
              <div className="pos-card closed" key={p.id}>
                <div className="pos-row">
                  <div className="pos-sym"><b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b><span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span></div>
                  <div className="pos-pnl"><span className="muted">Realized</span><b className={(p.realized_pnl || 0) >= 0 ? 'pos' : 'neg'}>{signed(p.realized_pnl)}</b></div>
                </div>
                <div className="pos-grid">
                  <div><span>Qty</span><b>{p.qty}</b></div>
                  <div><span>Avg buy</span><b>{fmtPrice(p.avg_price)}</b></div>
                  <div><span>Exit</span><b>{fmtPrice(p.exit_price)}</b></div>
                  <div><span>Closed</span><b>{fmtWhen(p.closed_at)}</b></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
