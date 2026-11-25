import { useEffect, useRef, useState } from 'react';
import { getCandles } from '../lib/candles';
import { computeUTBot } from '../lib/utBot';
import { fetchStoredCandles } from '../lib/watchlist';

// Roll a live tick into the forming 1-min / 5-min candle (or start a new one), recomputing
// the UT Bot each time so BUY/SELL signals and the trailing stop update in real time.
function applyTick(bars, tfSec, sec, price) {
  const start = Math.floor(sec / tfSec) * tfSec;
  const last = bars[bars.length - 1];
  if (last && last.ts_epoch === start) {
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
  } else if (!last || start > last.ts_epoch) {
    bars.push({ ts_epoch: start, datetime_ist: new Date(start * 1000).toISOString(), open: price, high: price, low: price, close: price, volume: 0 });
    if (bars.length > 800) bars.shift();
  }
}

/**
 * Candles for a symbol: real stored data (Dhan) from the API when available, else demo. The latest
 * tick then advances the forming candle live (demo motion while a market is open; real base either way).
 */
export function useLiveCandles(symbol, tick) {
  const [data, setData] = useState({ oneMin: [], fiveMin: [] });
  const st = useRef(null);

  useEffect(() => {
    let alive = true;
    st.current = null;
    setData({ oneMin: [], fiveMin: [] });

    const seed = (oneMin, fiveMin, real) => {
      if (!alive) return;
      st.current = {
        one: oneMin.map((b) => ({ ...b })),
        five: fiveMin.map((b) => ({ ...b })),
        price: oneMin.at(-1)?.close ?? 100,
        prevLtp: null,
        offset: null,
        real, // real Dhan data is shown as-is (no demo tick motion); demo data animates
      };
      setData({ oneMin: st.current.one, fiveMin: st.current.five });
    };

    fetchStoredCandles(symbol)
      .then((r) => {
        if (r.oneMin?.length) seed(r.oneMin, r.fiveMin, true);
        else { const d = getCandles(symbol); seed(d.oneMin, d.fiveMin, false); }
      })
      .catch(() => { const d = getCandles(symbol); seed(d.oneMin, d.fiveMin, false); });

    return () => { alive = false; };
  }, [symbol]);

  useEffect(() => {
    const s = st.current;
    if (!tick || !s || s.real) return; // real data stays as-is; only demo symbols animate

    if (s.prevLtp == null) s.prevLtp = tick.ltp;
    s.price = Math.max(1, +(s.price + (tick.ltp - s.prevLtp)).toFixed(2));
    s.prevLtp = tick.ltp;

    const rawSec = Math.floor((tick.ts || Date.now()) / 1000);
    if (s.offset == null) {
      const lastTs = s.one[s.one.length - 1]?.ts_epoch ?? rawSec;
      s.offset = lastTs + 60 - Math.floor(rawSec / 60) * 60;
    }
    const sec = rawSec + s.offset;

    applyTick(s.one, 60, sec, s.price);
    applyTick(s.five, 300, sec, s.price);
    s.one = computeUTBot(s.one, 1, 10);
    s.five = computeUTBot(s.five, 1, 10);
    setData({ oneMin: s.one, fiveMin: s.five });
  }, [tick]);

  return data;
}
