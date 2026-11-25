// DEMO intraday candles for a NIFTY 50 symbol, so the charts and BUY/SELL signals
// can be built and tested before real Dhan market data is wired in. A seeded random
// walk keeps each symbol's shape stable for the day. NOT real market data.
//
// When Dhan is connected: replace getCandles() with a backend call
// (GET /api/candles?symbol=&interval=) that returns the same bar shape, already
// carrying atr_trailing_stop / ut_bot_position / ut_bot_signal from the server.

import { computeUTBot } from './utBot';

// Approximate ₹ base prices so demo candles look realistic (mirrors backend config/nifty50.php).
// Replaced by real Dhan data once credentials + static IP are in place.
const BASE = {
  ADANIENT: 2400, ADANIPORTS: 1350, APOLLOHOSP: 7000, ASIANPAINT: 2500, AXISBANK: 1150,
  'BAJAJ-AUTO': 9500, BAJFINANCE: 1080, BAJAJFINSV: 1650, BEL: 290, BHARTIARTL: 1600,
  CIPLA: 1500, COALINDIA: 410, DRREDDY: 1250, EICHERMOT: 8100, GRASIM: 2600, HCLTECH: 1800,
  HDFCBANK: 1750, HDFCLIFE: 700, HEROMOTOCO: 4800, HINDALCO: 650, HINDUNILVR: 2500,
  ICICIBANK: 1300, INDUSINDBK: 1000, INFY: 1850, ITC: 480, JSWSTEEL: 1000, KOTAKBANK: 1800,
  LT: 3600, 'M&M': 3000, MARUTI: 12000, NESTLEIND: 2300, NTPC: 360, ONGC: 250, POWERGRID: 290,
  RELIANCE: 1347, SBILIFE: 1500, SBIN: 820, SHRIRAMFIN: 600, SUNPHARMA: 1700, TATACONSUM: 1100,
  TATAMOTORS: 780, TATASTEEL: 150, TCS: 2340, TECHM: 1600, TITAN: 3400, TRENT: 6500,
  ULTRACEMCO: 11500, WIPRO: 300, JIOFIN: 320, ADANIGREEN: 1100,
  GOLD: 120000, GOLDM: 120000, GOLDGUINEA: 96000, GOLDPETAL: 12000, SILVER: 95000, SILVERM: 95000,
  'NIFTY 50': 25700, BANKNIFTY: 58000, SENSEX: 82000, TMPV: 400, TMCV: 350,
  // Nifty Next 50
  ABB: 6500, ADANIENSOL: 850, ADANIPOWER: 550, AMBUJACEM: 550, DMART: 3800, BANKBARODA: 240,
  BERGEPAINT: 520, BHEL: 230, BPCL: 300, BOSCHLTD: 32000, BRITANNIA: 4800, CANBK: 95, CGPOWER: 680,
  CHOLAFIN: 1400, COLPAL: 2600, DABUR: 520, DIVISLAB: 5800, DLF: 780, GAIL: 190, GODREJCP: 1200,
  HAVELLS: 1600, HAL: 4200, HDFCAMC: 4200, ICICIGI: 1900, ICICIPRULI: 650, INDHOTEL: 780,
  INDIGO: 4500, IOC: 140, IRFC: 150, JINDALSTEL: 950, JSWENERGY: 580, LICI: 900, LODHA: 1300,
  LTIM: 6200, MARICO: 650, MOTHERSON: 160, NAUKRI: 1400, PFC: 420, PIDILITIND: 3000, PNB: 100,
  RECLTD: 500, SBICARD: 750, SHREECEM: 27000, SIEMENS: 6800, SRF: 2300, TATAPOWER: 420,
  TORNTPHARM: 3300, TVSMOTOR: 2800, UNIONBANK: 120, VBL: 620,
};

const basePrice = (symbol) => BASE[symbol] ?? 150 + (hashStr(symbol) % 3500);

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
  const base = basePrice(symbol);
  let price = base;
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
  for (let i = 0; i < endMinutes; i++) {
    // Random walk that mean-reverts toward the base, so the intraday range stays realistic.
    const open = price;
    const move = (rand() - 0.5) * base * 0.0016 + (base - open) * 0.0025;
    const close = Math.max(1, open + move);
    const high = Math.max(open, close) + rand() * base * 0.0007;
    const low = Math.min(open, close) - rand() * base * 0.0007;
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
