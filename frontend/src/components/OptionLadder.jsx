import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOptionChain, optKey, windowStrikes } from '../lib/options';
import { useOptionFeed } from '../hooks/useOptionFeed';
import { bestAsk, buyLeg, getPositions } from '../lib/paper';
import { fmtPrice } from '../lib/format';

const fmtExpiry = (iso) => (iso ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${iso}T00:00:00`)) : '');
const qty = (n) => (n ?? 0).toLocaleString('en-IN');
const exchOf = (seg) => (seg === 'BSE_FNO' ? 'BSE' : seg === 'MCX_COMM' ? 'MCX' : 'NSE');

// Zerodha/Dhan-style 5-level market depth for one option leg (fed live by the websocket).
function DepthCard({ d }) {
  if (!d) return <div className="depth-load">Loading depth…</div>;
  const totBuy = d.bid.reduce((a, b) => a + b.q, 0);
  const totSell = d.ask.reduce((a, b) => a + b.q, 0);
  const buyPct = totBuy + totSell ? (totBuy / (totBuy + totSell)) * 100 : 50;
  const chgPct = d.prevClose ? ((d.ltp - d.prevClose) / d.prevClose) * 100 : null;
  return (
    <div className="depth">
      <div className="depth-grid">
        <div className="depth-side">
          <div className="depth-h"><span>Bid</span><span>Qty</span><span>Orders</span></div>
          {d.bid.map((b, i) => (<div className="depth-r buy" key={i}><span className="p">{fmtPrice(b.p)}</span><span>{qty(b.q)}</span><span>{b.o}</span></div>))}
          <div className="depth-tot"><span>Total</span><span>{qty(totBuy)}</span><span /></div>
        </div>
        <div className="depth-side">
          <div className="depth-h"><span>Ask</span><span>Qty</span><span>Orders</span></div>
          {d.ask.map((a, i) => (<div className="depth-r sell" key={i}><span className="p">{fmtPrice(a.p)}</span><span>{qty(a.q)}</span><span>{a.o}</span></div>))}
          <div className="depth-tot"><span>Total</span><span>{qty(totSell)}</span><span /></div>
        </div>
      </div>
      <div className="depth-bar"><div className="buy" style={{ width: `${buyPct}%` }} /><div className="sell" style={{ width: `${100 - buyPct}%` }} /></div>
      <div className="depth-barlbl"><span className="pos">Bids {buyPct.toFixed(1)}%</span><span className="neg">Offers {(100 - buyPct).toFixed(1)}%</span></div>
      <div className="depth-today">
        <div><span>Open</span><b>{fmtPrice(d.open)}</b></div>
        <div><span>High</span><b>{fmtPrice(d.high)}</b></div>
        <div><span>Low</span><b>{fmtPrice(d.low)}</b></div>
        <div><span>Prev Close</span><b>{fmtPrice(d.prevClose)}</b></div>
        <div><span>Volume</span><b>{qty(d.vol)}</b></div>
        <div><span>LTP</span><b className={chgPct == null || chgPct >= 0 ? 'pos' : 'neg'}>{fmtPrice(d.ltp)}{chgPct != null ? ` (${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%)` : ''}</b></div>
      </div>
    </div>
  );
}

/**
 * Option-strike ladder for the selected script. Re-centres on the live spot, shows `each` strikes
 * either side with their CALL/PUT live prices, highlights the side matching the combined signal
 * (CALL on BUY, PUT on SELL), and expands any leg to full 5-level depth — all over the websocket.
 */
export default function OptionLadder({ symbol, spot, dir }) {
  const [chain, setChain] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null); // expanded leg key
  const [each, setEach] = useState(2);

  useEffect(() => {
    let on = true;
    setChain(null); setFailed(false); setOpen(null);
    getOptionChain(symbol).then((c) => on && setChain(c)).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, [symbol]);

  const win = useMemo(() => (chain ? windowStrikes(chain.strikes, spot, each) : []), [chain, spot, each]);

  const instruments = useMemo(() => {
    const out = [];
    for (const s of win) {
      if (s.ce) out.push({ key: optKey(s.ce.securityId), segment: s.ce.segment, securityId: s.ce.securityId });
      if (s.pe) out.push({ key: optKey(s.pe.securityId), segment: s.pe.segment, securityId: s.pe.securityId });
    }
    return out;
  }, [win]);

  const { ticks, depth } = useOptionFeed(instruments);

  const [positions, setPositions] = useState({}); // open positions by securityId
  const [busy, setBusy] = useState(false);
  const loadPositions = useCallback(() => {
    getPositions().then((r) => {
      const m = {};
      for (const p of r.positions) if (p.status === 'open') m[p.security_id] = p;
      setPositions(m);
    }).catch(() => {});
  }, []);
  useEffect(() => { loadPositions(); }, [loadPositions]);

  const doBuy = async (l, type, strike, lot, stage, price) => {
    if (price == null || busy) return;
    setBusy(true);
    try {
      await buyLeg({
        stage, security_id: l.securityId, segment: l.segment, underlying: chain.underlying,
        strike, option_type: type, expiry: chain.expiry, dhan_symbol: l.dhanSymbol,
        lot_size: lot || 1, price,
      });
      loadPositions();
    } catch { /* surfaced by the disabled state / next load */ }
    setBusy(false);
  };

  if (failed || (chain && !chain.strikes.length)) return null;
  if (!chain) return <div className="opt-wrap"><div className="opt-head">Loading option chain…</div></div>;

  const toggle = (strike) => setOpen((o) => (o === strike ? null : strike));

  const leg = (l, type, strike, lot) => {
    if (!l) return <span className="opt-cell empty" />;
    const key = optKey(l.securityId);
    const d = depth[key];
    const ltp = ticks[key]?.ltp ?? d?.ltp;
    const chg = d?.prevClose ? ((d.ltp - d.prevClose) / d.prevClose) * 100 : null;
    const hot = (dir === 'up' && type === 'CE') || (dir === 'down' && type === 'PE');
    const ask = bestAsk(d);
    const pos = positions[l.securityId];
    const done = new Set(pos?.stages_done || []);
    const stageBtn = (stage, label) => {
      const prevOk = stage === 'buy' || (stage === 'avg1' && done.has('buy')) || (stage === 'avg2' && done.has('avg1'));
      const disabled = done.has(stage) || !prevOk || ask == null || busy;
      return (
        <button type="button" className={`pt-btn ${type === 'CE' ? 'ce' : 'pe'}${done.has(stage) ? ' done' : ''}`} disabled={disabled} onClick={() => doBuy(l, type, strike, lot, stage, ask)}>
          {done.has(stage) ? '✓' : label}
        </button>
      );
    };
    return (
      <div className={`opt-cell ${type === 'CE' ? 'ce' : 'pe'}${hot ? ' hot' : ''}${open === strike ? ' open' : ''}`}>
        <button type="button" className="opt-px" onClick={() => toggle(strike)} title={`${l.dhanSymbol} — tap for depth`}>
          <span className="opt-ltp">{ltp != null ? fmtPrice(ltp) : '—'}</span>
          {chg != null && <span className={`opt-chg ${chg >= 0 ? 'pos' : 'neg'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>}
          {pos && <span className="opt-held">×{pos.qty}</span>}
        </button>
        <div className="opt-buy">
          <span className="opt-buy-ask">@{ask != null ? fmtPrice(ask) : '—'}</span>
          {stageBtn('buy', 'Buy')}{stageBtn('avg1', 'Avg1')}{stageBtn('avg2', 'Avg2')}
        </div>
      </div>
    );
  };

  const detail = (s, type) => {
    const l = type === 'CE' ? s.ce : s.pe;
    return (
      <div className={`opt-depth ${type === 'CE' ? 'ce' : 'pe'}`}>
        {l ? (
          <>
            <div className="opt-depth-h">
              <span className={`opt-depth-leg ${type === 'CE' ? 'ce' : 'pe'}`}>{type === 'CE' ? 'CALL' : 'PUT'}</span>
              <b>{l.dhanSymbol}</b>
              <span className={`exch exch-${exchOf(l.segment).toLowerCase()}`}>{exchOf(l.segment)}</span>
            </div>
            <DepthCard d={depth[optKey(l.securityId)]} />
          </>
        ) : <div className="depth-load">No contract at this strike.</div>}
      </div>
    );
  };

  return (
    <div className="opt-wrap">
      <div className="opt-head">
        <span className="opt-title">Option chain · {chain.underlying}</span>
        <span className="opt-exp">Exp {fmtExpiry(chain.expiry)}</span>
        {spot != null && <span className="opt-spot">Spot {fmtPrice(spot)}</span>}
        <span className="opt-each" title="Strikes shown on each side of spot">
          <button type="button" onClick={() => setEach((e) => Math.max(1, e - 1))} disabled={each <= 1} aria-label="Fewer strikes">−</button>
          <span>±{each}</span>
          <button type="button" onClick={() => setEach((e) => Math.min(8, e + 1))} disabled={each >= 8} aria-label="More strikes">+</button>
        </span>
      </div>
      <div className="opt-chain">
        <div className="opt-colh"><span className="ce">CALL</span><span className="k">Strike</span><span className="pe">PUT</span></div>
        {[...win].reverse().map((s) => (
          <div className="opt-strike" key={s.strike}>
            <div className={`opt-row${s.atm ? ' atm' : ''}`}>
              {leg(s.ce, 'CE', s.strike, s.lot || 1)}
              <button type="button" className="opt-k" onClick={() => toggle(s.strike)}>{s.strike}{s.atm && <em>ATM</em>}</button>
              {leg(s.pe, 'PE', s.strike, s.lot || 1)}
            </div>
            {open === s.strike && (
              <div className="opt-depth-pair">
                {detail(s, 'CE')}
                {detail(s, 'PE')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
