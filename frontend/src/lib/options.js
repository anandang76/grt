import { api } from './api';

// Option chain for an underlying (nearest non-expired expiry + full strike ladder). Cached per
// symbol for the session; the strikes don't change intraday, only the live prices do.
const cache = new Map();
export function getOptionChain(symbol) {
  if (!cache.has(symbol)) {
    cache.set(symbol, api(`/options/${encodeURIComponent(symbol)}`).catch((e) => { cache.delete(symbol); throw e; }));
  }
  return cache.get(symbol);
}

// Websocket key for an option leg (matches the ticker service's per-instrument key).
export const optKey = (securityId) => `OPT:${securityId}`;

// Pick `each` strikes on either side of the live spot, flagging the at-the-money strike.
export function windowStrikes(strikes, spot, each = 2) {
  if (!strikes?.length) return [];
  const mid = spot != null ? spot : strikes[Math.floor(strikes.length / 2)].strike;
  let idx = 0;
  let best = Infinity;
  strikes.forEach((s, i) => { const d = Math.abs(s.strike - mid); if (d < best) { best = d; idx = i; } });
  const lo = Math.max(0, idx - each);
  const hi = Math.min(strikes.length, idx + each + 1);
  return strikes.slice(lo, hi).map((s, i) => ({ ...s, atm: lo + i === idx }));
}
