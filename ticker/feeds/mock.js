// DEMO feed: random-walk prices so the UI can be built before broker credentials exist.
// Not real market data.
const BASE = {
  'NIFTY 50': 24500, 'NIFTY BANK': 52000, SENSEX: 80500,
  RELIANCE: 1290, TCS: 4100, HDFCBANK: 1750, INFY: 1880, ICICIBANK: 1290, SBIN: 820, ITC: 470,
};

export async function createFeed({ onTick }) {
  const state = new Map();
  const active = new Set();

  const seed = (s) => {
    const c = BASE[s] ?? 100 + (([...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7) % 2900);
    state.set(s, { c, o: c, h: c, l: c, ltp: c, v: 0 });
  };

  const timer = setInterval(() => {
    for (const s of active) {
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
