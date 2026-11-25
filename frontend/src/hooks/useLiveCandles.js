import { useEffect, useRef, useState } from 'react';
import { getCandles } from '../lib/candles';
import { computeUTBot } from '../lib/utBot';

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
 * Historical demo candles that then update live from the tick service.
 * `tick` is the latest {s, ltp, ts} for this symbol; each new one advances the chart.
 * Price continuity: we apply the tick's *movement* on top of the symbol's demo history,
 * and anchor live bars to continue right after the last historical bar.
 */
export function useLiveCandles(symbol, tick) {
  const [data, setData] = useState(() => getCandles(symbol));
  const st = useRef(null);

  useEffect(() => {
    const base = getCandles(symbol);
    st.current = {
      one: base.oneMin.map((b) => ({ ...b })),
      five: base.fiveMin.map((b) => ({ ...b })),
      price: base.oneMin.at(-1)?.close ?? 100,
      prevLtp: null,
      offset: null,
    };
    setData({ oneMin: st.current.one, fiveMin: st.current.five });
  }, [symbol]);

  useEffect(() => {
    const s = st.current;
    if (!tick || !s) return;

    if (s.prevLtp == null) s.prevLtp = tick.ltp;
    s.price = Math.max(1, +(s.price + (tick.ltp - s.prevLtp)).toFixed(2));
    s.prevLtp = tick.ltp;

    const rawSec = Math.floor((tick.ts || Date.now()) / 1000);
    if (s.offset == null) {
      const lastTs = s.one[s.one.length - 1]?.ts_epoch ?? rawSec;
      s.offset = lastTs + 60 - Math.floor(rawSec / 60) * 60; // first live 1-min bar sits right after history
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
