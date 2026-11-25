// DEMO intraday candles for a NIFTY 50 symbol, so the charts and BUY/SELL signals
// can be built and tested before real Dhan market data is wired in. A seeded random
// walk keeps each symbol's shape stable for the day. NOT real market data.
//
// When Dhan is connected: replace getCandles() with a backend call
// (GET /api/candles?symbol=&interval=) that returns the same bar shape, already
// carrying atr_trailing_stop / ut_bot_position / ut_bot_signal from the server.

import { computeUTBot } from './utBot';

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Resample 1-min bars into a larger timeframe (minutes), matching resample_ohlcv's
// left-labelled, left-closed bucketing from the Python code.
function resample(oneMin, minutes) {
  const bucketMs = minutes * 60 * 1000;
  const out = [];
  let cur = null;
  for (const b of oneMin) {
    const start = Math.floor((b.ts_epoch * 1000) / bucketMs) * bucketMs;
    if (!cur || cur._start !== start) {
      if (cur) out.push(cur);
      cur = { _start: start, ts_epoch: Math.floor(start / 1000), datetime_ist: new Date(start).toISOString(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  if (cur) out.push(cur);
  return out.map(({ _start, ...b }) => b);
}

// Build a full trading day of 1-min bars (09:15–15:30 IST) for the most recent weekday.
function buildOneMin(symbol) {
  const rand = seededRandom(hashStr(symbol + new Date().toISOString().slice(0, 10)));
  let price = 150 + (hashStr(symbol) % 3500);
  const now = new Date();
  const day = new Date(now);
  // Most recent weekday (today if a weekday, else roll back).
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() - 1);
  const start = new Date(day);
  start.setHours(9, 15, 0, 0);

  // If it's today and within market hours, only go up to "now".
  const sameDay = day.toDateString() === now.toDateString();
  const endMinutes = sameDay ? Math.min(375, Math.max(30, Math.floor((now - start) / 60000))) : 375;

  const bars = [];
  let drift = 0;
  for (let i = 0; i < endMinutes; i++) {
    drift += (rand() - 0.5) * 0.0008; // slow trend component
    drift *= 0.96;
    const move = (rand() - 0.5) * price * 0.0016 + drift * price;
    const open = price;
    const close = Math.max(1, open + move);
    const high = Math.max(open, close) + rand() * price * 0.0008;
    const low = Math.min(open, close) - rand() * price * 0.0008;
    const dt = new Date(start.getTime() + i * 60000);
    bars.push({
      ts_epoch: Math.floor(dt.getTime() / 1000),
      datetime_ist: dt.toISOString(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(2000 + rand() * 40000),
    });
    price = close;
  }
  return bars;
}

const cache = new Map();

/** Returns { oneMin, fiveMin } bar arrays with UT Bot fields, cached per symbol for the session. */
export function getCandles(symbol) {
  if (!cache.has(symbol)) {
    const oneMin = buildOneMin(symbol);
    cache.set(symbol, {
      oneMin: computeUTBot(oneMin, 1, 10),
      fiveMin: computeUTBot(resample(oneMin, 5), 1, 10),
    });
  }
  return cache.get(symbol);
}

/** Last price + day change for a symbol, from its demo candles. */
export function quote(symbol) {
  const { oneMin } = getCandles(symbol);
  if (!oneMin.length) return null;
  const first = oneMin[0].open;
  const last = oneMin[oneMin.length - 1].close;
  const ch = last - first;
  return { ltp: last, ch, chp: (ch / first) * 100 };
}
