import { useEffect, useMemo, useState } from 'react';
import { getNifty50, MAX_WATCHLIST } from '../lib/watchlist';
import { Alert, Button } from './ui';

/**
 * Pick 0–10 symbols from the NIFTY 50. Controlled by a parent that persists via onSave(symbols).
 * Used by the user's own watchlist page and by admins on a user's detail page.
 */
export default function WatchlistEditor({ initial = [], onSave, onCancel, saving, error }) {
  const [all, setAll] = useState(null);
  const [picked, setPicked] = useState(initial.map((s) => (typeof s === 'string' ? s : s.symbol)));
  const [q, setQ] = useState('');

  useEffect(() => { getNifty50().then(setAll).catch(() => setAll([])); }, []);

  const toggle = (sym) =>
    setPicked((p) => (p.includes(sym) ? p.filter((s) => s !== sym) : p.length >= MAX_WATCHLIST ? p : [...p, sym]));

  const list = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((c) => c.symbol.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) : all;
  }, [all, q]);

  if (!all) return <div className="empty">Loading NIFTY 50…</div>;

  return (
    <div className="wl-editor">
      <div className="wl-editor-h">
        <span className="muted small">{picked.length} / {MAX_WATCHLIST} selected</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or symbol" aria-label="Search NIFTY 50" />
      </div>
      <Alert>{error}</Alert>
      <div className="wl-grid">
        {list.map((c) => {
          const on = picked.includes(c.symbol);
          const full = !on && picked.length >= MAX_WATCHLIST;
          return (
            <label key={c.symbol} className={`wl-pick${on ? ' on' : ''}${full ? ' disabled' : ''}`}>
              <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(c.symbol)} />
              <span className="wl-sym">{c.symbol}</span>
              <span className="wl-name">{c.name}</span>
            </label>
          );
        })}
      </div>
      <div className="wl-editor-f">
        {onCancel && <button type="button" className="btn btn-line" onClick={onCancel} disabled={saving}>Cancel</button>}
        <Button busy={saving} onClick={() => onSave(picked)}>Save watchlist</Button>
      </div>
    </div>
  );
}
