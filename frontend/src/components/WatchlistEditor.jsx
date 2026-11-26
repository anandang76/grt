import { useEffect, useMemo, useState } from 'react';
import { getInstruments } from '../lib/watchlist';
import { Alert, Button } from './ui';

const GROUP_ORDER = ['index', 'mcx', 'nifty50', 'next50'];
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const num = (v) => nf.format(Number(v) || 0);
const pct = (v) => { const n = Number(v) || 0; return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };

// Columns after the checkbox + symbol/name: LTP, then 52-week, 5-day, 1-day (high / low / %).
const COLS = [
  { key: 'ltp', label: 'LTP', num: true },
  { key: 'week52_high', label: '52W H', num: true },
  { key: 'week52_low', label: '52W L', num: true },
  { key: 'week52_pct', label: '52W %', pct: true },
  { key: 'd5_high', label: '5D H', num: true },
  { key: 'd5_low', label: '5D L', num: true },
  { key: 'd5_pct', label: '5D %', pct: true },
  { key: 'd1_high', label: '1D H', num: true },
  { key: 'd1_low', label: '1D L', num: true },
  { key: 'd1_pct', label: '1D %', pct: true },
];

function Head({ label, col, sort, setSort, right }) {
  const active = sort.key === col;
  return (
    <th className={`sortable${right ? ' num' : ''}${active ? ' on' : ''}`} onClick={() => setSort(active ? { key: col, dir: -sort.dir } : { key: col, dir: 1 })}>
      {label}{active ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

function GroupTable({ label, rows, picked, toggle, sort, setSort, atCap }) {
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const val = (r) => (sort.key === 'name' ? r.name.toLowerCase() : sort.key === 'symbol' ? r.symbol.toLowerCase() : r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  if (!rows.length) return null;
  return (
    <div className="card tcard wl-group">
      <div className="tcard-h"><h2>{label}</h2><span className="muted small">{rows.length}</span></div>
      <div className="wl-table-scroll">
        <table className="rt wl-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <Head label="Symbol / Name" col="symbol" sort={sort} setSort={setSort} />
              {COLS.map((c) => <Head key={c.key} label={c.label} col={c.key} sort={sort} setSort={setSort} right />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const on = picked.has(r.symbol);
              const disabled = !on && atCap;
              return (
                <tr key={r.symbol} className={on ? 'sel' : ''} onClick={() => !disabled && toggle(r.symbol)} style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
                  <td><input type="checkbox" checked={on} disabled={disabled} readOnly /></td>
                  <td className="wl-sym-cell">
                    <b>{r.display}</b>{r.live === false && <span className="idx-tag mcx" title="Demo data — not mapped to Dhan">demo</span>}
                    <span className="wl-name-cell">{r.name}</span>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className={`num${c.pct ? (r[c.key] >= 0 ? ' pos' : ' neg') : ''}`}>
                      {c.pct ? pct(r[c.key]) : num(r[c.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Grouped, searchable, sortable instrument picker. Controlled by a parent that saves via onSave(symbols).
 *  `fetcher` supplies {instruments, groups, max}; defaults to the user's selectable list. */
export default function WatchlistEditor({ initial = [], onSave, onCancel, saving, error, fetcher = getInstruments, emptyHint, saveLabel = 'Save watchlist' }) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState(() => new Set(initial.map((s) => (typeof s === 'string' ? s : s.symbol))));
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetcher().then(setData).catch(() => setData({ instruments: [], groups: {}, max: 25 })); }, []);

  const max = data?.max ?? 25;
  const atCap = picked.size >= max;

  const toggle = (sym) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(sym)) n.delete(sym);
    else if (n.size < max) n.add(sym);
    return n;
  });

  const byGroup = useMemo(() => {
    if (!data) return {};
    const needle = q.trim().toLowerCase();
    const match = (r) => !needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle) || r.display.toLowerCase().includes(needle);
    const g = {};
    for (const r of data.instruments) if (match(r)) (g[r.group] ||= []).push(r);
    return g;
  }, [data, q]);

  if (!data) return <div className="empty">Loading instruments…</div>;

  if (!data.instruments.length) {
    return (
      <div className="wl-editor">
        <Alert>{error}</Alert>
        <div className="card center" style={{ padding: 28 }}>
          <p className="sub" style={{ margin: 0 }}>{emptyHint || "No scripts are enabled yet. An admin needs to set this week's master list before you can build a watchlist."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-editor">
      <div className="wl-editor-h">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or name…" aria-label="Search instruments" />
        <span className="muted small">{picked.size} / {max} selected</span>
        <Button className="btn-sm" busy={saving} onClick={() => onSave([...picked])}>{saveLabel}</Button>
      </div>
      {data.restricted && <p className="muted small" style={{ margin: '0 0 10px' }}>Choose from this week’s master list — {data.instruments.length} scripts available.</p>}
      <Alert>{error}</Alert>

      {GROUP_ORDER.map((g) => (
        <GroupTable key={g} label={data.groups[g] || g} rows={byGroup[g] || []} picked={picked} toggle={toggle} sort={sort} setSort={setSort} atCap={atCap} />
      ))}

      <div className="wl-editor-f">
        {onCancel && <button type="button" className="btn btn-line" onClick={onCancel} disabled={saving}>Cancel</button>}
        <Button busy={saving} onClick={() => onSave([...picked])}>{saveLabel}</Button>
      </div>
    </div>
  );
}
