import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/ui';
import { useOptionFeed } from '../hooks/useOptionFeed';
import { optKey } from '../lib/options';
import { bestAsk, bestBid, buyLeg, getPositions, squareOff } from '../lib/paper';
import { fmtPrice } from '../lib/format';

const exchOf = (seg) => (seg === 'BSE_FNO' ? 'BSE' : seg === 'MCX_COMM' ? 'MCX' : 'NSE');
const nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${nf.format(Math.abs(v))}`);
const pnlClass = (v) => (v == null ? '' : v >= 0 ? 'pos' : 'neg');
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

export default function Positions() {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => getPositions().then(setData).catch(() => setData({ positions: [] })), []);
  useEffect(() => { load(); }, [load]);

  const positions = data?.positions || [];
  const open = positions.filter((p) => p.status === 'open');
  const closed = positions.filter((p) => p.status === 'closed');

  // Stream every contract we hold or held (deduped) so closed rows can show live LTP + a rebuy price.
  const sig = positions.map((p) => p.security_id).join(',');
  const instruments = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of positions) if (!seen.has(p.security_id)) { seen.add(p.security_id); out.push({ key: optKey(p.security_id), segment: p.segment, securityId: p.security_id }); }
    return out;
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ticks, depth } = useOptionFeed(instruments);

  const ltpOf = (p) => ticks[optKey(p.security_id)]?.ltp ?? depth[optKey(p.security_id)]?.ltp ?? null;
  const askOf = (p) => bestAsk(depth[optKey(p.security_id)]);

  const rebuy = async (p) => {
    const ask = askOf(p) ?? ltpOf(p);
    if (ask == null) { window.alert('No live price yet — wait for the depth to stream.'); return; }
    if (!window.confirm(`Rebuy ${p.dhan_symbol} — buy ${p.qty || p.lot_size} @ ${fmtPrice(ask)} (ask)?`)) return;
    setBusyId(`r${p.id}`);
    try {
      await buyLeg({ stage: 'buy', security_id: p.security_id, segment: p.segment, underlying: p.underlying, strike: p.strike, option_type: p.option_type, expiry: p.expiry, dhan_symbol: p.dhan_symbol, lot_size: p.lot_size || p.qty || 1, price: ask });
      await load();
    } catch { /* ignore */ }
    setBusyId(null);
  };

  const liveOf = (p) => {
    const d = depth[optKey(p.security_id)];
    const ltp = ticks[optKey(p.security_id)]?.ltp ?? d?.ltp ?? null;
    const sell = bestBid(d);                                   // the bid you'd actually sell into
    return {
      ltp,
      sell,
      ltpPnl: ltp != null ? (ltp - p.avg_price) * p.qty : null,
      sellPnl: sell != null ? (sell - p.avg_price) * p.qty : null,
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
  const totLtp = live.reduce((a, { l }) => a + (l.ltpPnl || 0), 0);
  const totSell = live.reduce((a, { l }) => a + (l.sellPnl || 0), 0);

  return (
    <div className="card pos-page">
      <div className="pos-head">
        <h1>Paper positions</h1>
        <div className="pos-head-r">
          <span className="pos-tot-chip">Total LTP P&amp;L <b className={pnlClass(totLtp)}>{open.length ? signed(totLtp) : '—'}</b></span>
          <span className="pos-tot-chip">Sell (Bid) P&amp;L <b className={pnlClass(totSell)}>{open.length ? signed(totSell) : '—'}</b></span>
          <button type="button" className="btn btn-sm btn-line" onClick={load}>↻</button>
          <Link className="btn btn-sm btn-line" to="/home">Terminal</Link>
        </div>
      </div>

      {open.length === 0 ? <div className="empty">No open positions. Buy a CE/PE from the option ladder on the terminal.</div> : (
        <div className="pos-scroll">
          <table className="pos-table fixed">
            <colgroup>
              <col style={{ width: '120px' }} /><col /><col style={{ width: '66px' }} /><col style={{ width: '96px' }} />
              <col style={{ width: '96px' }} /><col style={{ width: '104px' }} /><col style={{ width: '116px' }} /><col style={{ width: '124px' }} /><col style={{ width: '116px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Trade time</th><th>Symbol</th><th className="num">Qty</th><th className="num">Buy price</th>
                <th className="num">LTP</th><th className="num">Sell (bid)</th>
                <th className="num">LTP P&amp;L</th><th className="num">Sell (bid) P&amp;L</th><th className="acts"></th>
              </tr>
            </thead>
            <tbody>
              {live.map(({ p, l }) => (
                <tr key={p.id}>
                  <td className="when">{fmtWhen(p.opened_at)}</td>
                  <td className="sym"><b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b><span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span></td>
                  <td className="num">{p.qty}</td>
                  <td className="num">{fmtPrice(p.avg_price)}</td>
                  <td className="num">{l.ltp != null ? fmtPrice(l.ltp) : '—'}</td>
                  <td className="num sell-px">{l.sell != null ? fmtPrice(l.sell) : '—'}</td>
                  <td className={`num ${pnlClass(l.ltpPnl)}`}>{signed(l.ltpPnl)}</td>
                  <td className={`num ${pnlClass(l.sellPnl)}`}>{signed(l.sellPnl)}</td>
                  <td className="acts"><button type="button" className="btn btn-xs btn-danger" disabled={busyId === p.id} onClick={() => square(p)}>{busyId === p.id ? '…' : 'Square off'}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pos-tot">
                <td colSpan={6}>Total</td>
                <td className={`num ${pnlClass(totLtp)}`}>{signed(totLtp)}</td>
                <td className={`num ${pnlClass(totSell)}`}>{signed(totSell)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="pos-h2">Closed · {closed.length}</h2>
          <div className="pos-scroll">
            <table className="pos-table fixed">
              <colgroup>
                <col style={{ width: '120px' }} /><col /><col style={{ width: '66px' }} /><col style={{ width: '96px' }} />
                <col style={{ width: '96px' }} /><col style={{ width: '124px' }} /><col style={{ width: '96px' }} /><col style={{ width: '120px' }} /><col style={{ width: '150px' }} />
              </colgroup>
              <thead>
                <tr><th>Trade time</th><th>Symbol</th><th className="num">Qty</th><th className="num">Buy price</th><th className="num">Exit</th><th className="num">Realized P&amp;L</th><th className="num">LTP</th><th>Closed</th><th className="acts"></th></tr>
              </thead>
              <tbody>
                {closed.map((p) => {
                  const ltp = ltpOf(p);
                  const ask = askOf(p) ?? ltp;
                  return (
                    <tr key={p.id}>
                      <td className="when">{fmtWhen(p.opened_at)}</td>
                      <td className="sym"><b>{p.dhan_symbol || `${p.underlying} ${p.strike} ${p.option_type}`}</b><span className={`exch exch-${exchOf(p.segment).toLowerCase()}`}>{exchOf(p.segment)}</span></td>
                      <td className="num">{p.qty}</td>
                      <td className="num">{fmtPrice(p.avg_price)}</td>
                      <td className="num">{fmtPrice(p.exit_price)}</td>
                      <td className={`num ${pnlClass(p.realized_pnl)}`}>{signed(p.realized_pnl)}</td>
                      <td className="num">{ltp != null ? fmtPrice(ltp) : '—'}</td>
                      <td className="when">{fmtWhen(p.closed_at)}</td>
                      <td className="acts"><button type="button" className="btn btn-xs btn-line" disabled={ask == null || busyId === `r${p.id}`} onClick={() => rebuy(p)}>{busyId === `r${p.id}` ? '…' : `Rebuy @ ${ask != null ? fmtPrice(ask) : '—'}`}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
