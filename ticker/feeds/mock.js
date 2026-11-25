// DEMO feed: random-walk prices so the UI can be built before broker credentials exist.
// Not real market data. Respects Indian market hours (IST) so symbols only move while their
// market is open — NSE/BSE equities & indices 09:15–15:30, MCX commodities till 23:30,
// GIFT Nifty into the night. When a market is closed its price is frozen (no ticks).
const BASE = {
  'NIFTY 50': 25700, BANKNIFTY: 58000, SENSEX: 82000, GIFTNIFTY: 25750,
  RELIANCE: 1347, TCS: 2340, EICHERMOT: 8100,
};

const MCX = new Set(['GOLD', 'GOLDM', 'GOLDGUINEA', 'GOLDPETAL', 'SILVER', 'SILVERM']);

function istNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { mins: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10), weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun' };
}

// Is the given symbol's market open right now (IST)?
function marketOpen(symbol, t) {
  if (t.weekend) return false;                              // markets closed Sat/Sun
  if (MCX.has(symbol)) return t.mins >= 540 && t.mins <= 1410;   // MCX 09:00–23:30
  if (symbol === 'GIFTNIFTY') return t.mins >= 390 && t.mins < 1440; // GIFT Nifty ~06:30–23:59
  return t.mins >= 555 && t.mins <= 930;                    // NSE/BSE equities & indices 09:15–15:30
}

export async function createFeed({ onTick }) {
  const state = new Map();
  const active = new Set();

  const seed = (s) => {
    const c = BASE[s] ?? 100 + (([...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7) % 2900);
    state.set(s, { c, o: c, h: c, l: c, ltp: c, v: 0 });
  };

  const timer = setInterval(() => {
    const t = istNow();
    for (const s of active) {
      if (!marketOpen(s, t)) continue; // market closed → price frozen, no tick
      const st = state.get(s);
      st.ltp = Math.max(0.05, +(st.ltp * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2));
      st.h = Math.max(st.h, st.ltp);
      st.l = Math.min(st.l, st.ltp);
      st.v += Math.floor(Math.random() * 500);
      const ch = +(st.ltp - st.c).toFixed(2);
      onTick({ s, ltp: st.ltp, ch, chp: +((ch / st.c) * 100).toFixed(2), o: st.o, h: st.h, l: st.l, c: st.c, v: st.v, ts: Date.now() });
    }
  }, 1000);

  return {
    subscribe(symbols) {
      for (const s of symbols) {
        if (!state.has(s)) seed(s);
        active.add(s);
      }
    },
    unsubscribe(symbols) {
      for (const s of symbols) active.delete(s);
    },
    close() {
      clearInterval(timer);
    },
  };
}
