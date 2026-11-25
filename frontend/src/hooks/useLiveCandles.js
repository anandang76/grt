import { useCallback, useEffect, useRef, useState } from 'react';
import { getCandles } from '../lib/candles';
import { marketOpen } from '../lib/market';
import { computeUTBot } from '../lib/utBot';
import { fetchStoredCandles } from '../lib/watchlist';

// Roll a live LTP tick into the forming 1-min / 5-min candle (or start a new one), recomputing
// the UT Bot so BUY/SELL signals and the trailing stop update in real time.
function applyTick(bars, tfSec, sec, price) {
  const start = Math.floor(sec / tfSec) * tfSec;
  const last = bars[bars.length - 1];
  if (last && last.ts_epoch === start) {
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
  } else if (!last || start > last.ts_epoch) {
    bars.push({ ts_epoch: start, datetime_ist: new Date(start * 1000).toISOString(), open: price, high: price, low: price, close: price, volume: 0 });
    if (bars.length > 1200) bars.shift();
  }
}

/**
 * Candles for a symbol: real stored history (Dhan) loaded once, then advanced live by the Dhan
 * websocket feed (`tick` = latest {ltp, ts}). No polling. Demo fallback for unmapped symbols.
 */
export function useLiveCandles(symbol, kind, tick) {
  const [data, setData] = useState({ oneMin: [], fiveMin: [] });
  const [refreshing, setRefreshing] = useState(false);
  const st = useRef(null);

  // Clear today's rows and re-pull per-minute data from Dhan (server deletes + reinserts +
  // recomputes the UT Bot), then reseed the chart. Live ticks continue after.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetchStoredCandles(symbol, true);
      if (r.oneMin?.length) {
        st.current = { one: r.oneMin.map((b) => ({ ...b })), five: r.fiveMin.map((b) => ({ ...b })) };
        setData({ oneMin: st.current.one, fiveMin: st.current.five });
      }
    } finally {
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => {
    let alive = true;
    st.current = null;
    setData({ oneMin: [], fiveMin: [] });

    const seed = (oneMin, fiveMin) => {
      if (!alive) return;
      st.current = { one: oneMin.map((b) => ({ ...b })), five: fiveMin.map((b) => ({ ...b })) };
      setData({ oneMin: st.current.one, fiveMin: st.current.five });
    };

    fetchStoredCandles(symbol, marketOpen(kind))
      .then((r) => { if (r.oneMin?.length) seed(r.oneMin, r.fiveMin); else { const d = getCandles(symbol); seed(d.oneMin, d.fiveMin); } })
      .catch(() => { const d = getCandles(symbol); seed(d.oneMin, d.fiveMin); });

    return () => { alive = false; };
  }, [symbol, kind]);

  useEffect(() => {
    const s = st.current;
    if (!tick || !s || !(tick.ltp > 0)) return;
    const sec = Math.floor((tick.ts || Date.now()) / 1000);
    applyTick(s.one, 60, sec, tick.ltp);
    applyTick(s.five, 300, sec, tick.ltp);
    s.one = computeUTBot(s.one, 1, 10);
    s.five = computeUTBot(s.five, 1, 10);
    setData({ oneMin: s.one, fiveMin: s.five });
  }, [tick]);

  return { oneMin: data.oneMin, fiveMin: data.fiveMin, refresh, refreshing };
}
