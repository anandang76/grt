import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Loading } from '../../components/ui';
import { isSuper, useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { eraseAllHistory, eraseHistory, getHistoryDays, getHistorySymbols, HISTORY_MAX_DAYS, updateHistory } from '../../lib/history';

const CONFIRM_PHRASE = 'I UNDERSTAND';

function EraseAllDialog({ onClose, onDone }) {
  const [text, setText] = useState('');
  const s = useSubmitState();

  const run = () => s.run(async () => {
    const r = await eraseAllHistory(text.trim());
    onDone(r.message);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Erase ALL candle data</h2>
        <p className="muted">This permanently clears stored intraday candles for <b>every instrument</b> — all tables at once. Watchlists, users and settings are not affected. This cannot be undone, but you can re-pull data afterward.</p>
        <p className="small">Type <b>{CONFIRM_PHRASE}</b> to confirm.</p>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={CONFIRM_PHRASE} aria-label="Confirmation phrase" autoFocus />
        <Alert>{s.error}</Alert>
        <div className="modal-f">
          <button type="button" className="btn btn-line" onClick={onClose} disabled={s.busy}>Cancel</button>
          <Button className="btn-err" busy={s.busy} disabled={text.trim() !== CONFIRM_PHRASE} onClick={run}>Erase all data</Button>
        </div>
      </div>
    </div>
  );
}

// Minimal local submit state (avoids pulling the form hook here).
function useSubmitState() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function SymbolMenu({ symbols, active, onPick, onErasedAll }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(false);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? symbols.filter((s) => s.symbol.toLowerCase().includes(n) || s.name.toLowerCase().includes(n)) : symbols;
  }, [symbols, q]);
  return (
    <aside className="hist-side">
      <div className="hist-side-h">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search script" aria-label="Search script" />
      </div>
      <div className="hist-syms">
        {list.map((s) => (
          <button key={s.symbol} className={`hist-sym${active === s.symbol ? ' on' : ''}`} onClick={() => onPick(s.symbol)}>
            <span className="hist-sym-s">{s.symbol}{s.kind === 'index' && <span className="idx-tag">IDX</span>}{s.kind === 'commodity' && <span className="idx-tag mcx">MCX</span>}</span>
            <span className={`hist-sym-d${s.days ? ' has' : ''}`}>{s.days ? `${s.days}d` : '—'}</span>
          </button>
        ))}
      </div>
      {isSuper(user) && (
        <div className="hist-erase-all">
          <button type="button" className="btn btn-err btn-block" onClick={() => setDialog(true)}>Erase ALL Data</button>
          <p className="hint">Super Admin only · clears every table</p>
        </div>
      )}
      {dialog && <EraseAllDialog onClose={() => setDialog(false)} onDone={(msg) => { setDialog(false); onErasedAll(msg); }} />}
    </aside>
  );
}

function DaysPanel({ symbol, onUpdated }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => { setData(null); setSel(new Set()); setMsg(null); getHistoryDays(symbol).then(setData).catch((e) => setMsg({ type: 'err', text: e.message })); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [symbol]);

  const toggle = (date) => setSel((s) => {
    const n = new Set(s);
    if (n.has(date)) n.delete(date);
    else if (n.size < HISTORY_MAX_DAYS) n.add(date);
    return n;
  });

  const pickLast = (count) => setSel(new Set(data.days.slice(0, count).map((d) => d.date)));

  const run = async () => {
    if (!sel.size) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await updateHistory(symbol, [...sel]);
      const okCount = Object.values(r.results).filter((x) => x.ok).length;
      const failed = Object.entries(r.results).filter(([, x]) => !x.ok).map(([d]) => d);
      setMsg({ type: okCount ? 'ok' : 'err', text: `Updated ${okCount} day(s)${failed.length ? `; skipped ${failed.length} (non-trading day)` : ''}.` });
      setSel(new Set());
      setData(await getHistoryDays(symbol));
      onUpdated();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (!confirm(`Erase ALL stored data for ${symbol}? This clears its table.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await eraseHistory(symbol);
      setMsg({ type: 'ok', text: r.message });
      setSel(new Set());
      setData(await getHistoryDays(symbol));
      onUpdated();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="hist-main"><Loading /></div>;

  return (
    <div className="hist-main">
      <div className="page-h">
        <div><h2 style={{ margin: 0 }}>{data.name} <span className="muted">· {symbol}</span></h2><p className="muted small" style={{ margin: 0 }}>Last 30 trading days. Pick up to {HISTORY_MAX_DAYS} to pull and recompute.</p></div>
      </div>

      <div className="hist-actions">
        <button className="btn btn-sm btn-line" onClick={() => pickLast(5)}>Last 5</button>
        <button className="btn btn-sm btn-line" onClick={() => pickLast(10)}>Last 10</button>
        <button className="btn btn-sm btn-line" onClick={() => pickLast(15)}>Last 15</button>
        <button className="btn btn-sm btn-line" onClick={() => pickLast(22)}>Last 1 month</button>
        <button className="btn btn-sm btn-line" onClick={() => setSel(new Set())} disabled={!sel.size}>Clear</button>
        <button className="btn btn-sm btn-err" onClick={erase} disabled={busy}>Erase table</button>
        <span className="grow" />
        <button className="btn btn-sm" onClick={run} disabled={busy || !sel.size}>{busy ? 'Working…' : `Update ${sel.size || ''}`}</button>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <div className="card tcard">
        <table className="rt hist-days">
          <thead><tr><th style={{ width: 36 }}></th><th>Date</th><th>Stored</th><th>Last updated</th></tr></thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date} className={sel.has(d.date) ? 'sel' : ''} onClick={() => toggle(d.date)} style={{ cursor: 'pointer' }}>
                <td data-l=""><input type="checkbox" checked={sel.has(d.date)} readOnly /></td>
                <td data-l="Date"><b>{d.label}</b></td>
                <td data-l="Stored">{d.minutes ? <span className="badge b-active">{d.minutes} min</span> : <span className="muted">—</span>}</td>
                <td data-l="Last updated">{d.updated_at ? fmtDate(d.updated_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HistoryData() {
  const [symbols, setSymbols] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = () => getHistorySymbols().then((r) => setSymbols(r.symbols)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <Alert>{err}</Alert>;
  if (!symbols) return <Loading />;

  const erasedAll = (msg) => { setNotice(msg); setActive(null); load(); };

  return (
    <>
      <div className="page-h"><h1>History data</h1><span className="muted small">Pull and store intraday candles per script</span></div>
      {notice && <Alert type="ok">{notice}</Alert>}
      <div className="hist-wrap">
        <SymbolMenu symbols={symbols} active={active} onPick={setActive} onErasedAll={erasedAll} />
        {active
          ? <DaysPanel symbol={active} onUpdated={load} />
          : <div className="hist-main"><div className="empty">Pick a script on the left to see its last 30 days.</div></div>}
      </div>
    </>
  );
}
