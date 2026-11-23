// Zerodha Kite Connect feed (FEED=kite). NOT IMPLEMENTED YET.
//
// Plan:
//   npm install kiteconnect
//   import { KiteTicker } from 'kiteconnect';
//   const t = new KiteTicker({ api_key: KITE_API_KEY, access_token: KITE_ACCESS_TOKEN });
//   t.on('ticks', (ticks) => ticks.forEach((k) => onTick(normalize(k))));
//   t.connect(); t.setMode(t.modeQuote, instrumentTokens);
//
// Needs: a symbol -> instrument_token map (from the daily instruments dump, https://api.kite.trade/instruments),
// and a fresh access token each day (Kite login flow, handled by Laravel).
// Output tick shape must match feeds/mock.js: { s, ltp, ch, chp, o, h, l, c, v, ts }.

export async function createFeed() {
  throw new Error('Kite feed is not implemented yet. Set FEED=mock in ticker/.env for now.');
}
