import { useEffect, useState } from 'react';
import { getCandles } from '../lib/candles';
import { marketOpen } from '../lib/market';
import { fetchStoredCandles } from '../lib/watchlist';

const POLL_MS = 45000; // near-live refresh while the market is open

/**
 * Candles for a symbol: real stored data (Dhan) from the API, demo fallback otherwise.
 * While the instrument's market is open it re-pulls today's latest from Dhan every ~45s,
 * so MCX keeps updating through its evening session. True tick streaming needs the Dhan
 * live websocket (next step); this is near-live polling.
 */
export function useLiveCandles(symbol, kind) {
  const [data, setData] = useState({ oneMin: [], fiveMin: [] });

  useEffect(() => {
    let alive = true;
    let timer;

    const load = (fresh) =>
      fetchStoredCandles(symbol, fresh)
        .then((r) => {
          if (!alive) return;
          if (r.oneMin?.length) setData({ oneMin: r.oneMin, fiveMin: r.fiveMin });
          else { const d = getCandles(symbol); setData({ oneMin: d.oneMin, fiveMin: d.fiveMin }); }
        })
        .catch(() => { if (alive) { const d = getCandles(symbol); setData({ oneMin: d.oneMin, fiveMin: d.fiveMin }); } });

    setData({ oneMin: [], fiveMin: [] });
    load(marketOpen(kind)); // fresh pull on open if market is live
    timer = setInterval(() => { if (marketOpen(kind)) load(true); }, POLL_MS);

    return () => { alive = false; clearInterval(timer); };
  }, [symbol, kind]);

  return data;
}
