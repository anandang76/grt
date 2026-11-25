import { useEffect, useMemo, useState } from 'react';
import { Alert, Loading } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { eraseHistory, getHistoryDays, getHistorySymbols, HISTORY_MAX_DAYS, updateHistory } from '../../lib/history';

function SymbolMenu({ symbols, active, onPick }) {
  const [q, setQ] = useState('');
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
        <button className="btn btn-sm btn-line" onClick={() => pickLast(5)}>Last 5 days</button>
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

  const load = () => getHistorySymbols().then((r) => setSymbols(r.symbols)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <Alert>{err}</Alert>;
  if (!symbols) return <Loading />;

  return (
    <>
      <div className="page-h"><h1>History data</h1><span className="muted small">Pull and store intraday candles per script</span></div>
      <div className="hist-wrap">
        <SymbolMenu symbols={symbols} active={active} onPick={setActive} />
        {active
          ? <DaysPanel symbol={active} onUpdated={load} />
          : <div className="hist-main"><div className="empty">Pick a script on the left to see its last 30 days.</div></div>}
      </div>
    </>
  );
}
