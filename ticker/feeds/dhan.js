// Dhan live market feed (FEED=dhan). NOT IMPLEMENTED YET.
//
// Plan:
//   Connect to wss://api-feed.dhan.co?version=2&token=DHAN_ACCESS_TOKEN&clientId=DHAN_CLIENT_ID&authType=2
//   Send JSON subscribe requests ({ RequestCode: 15, InstrumentCount, InstrumentList: [{ ExchangeSegment, SecurityId }] }).
//   Parse the little-endian binary response packets (ticker/quote/full) into ticks.
//
// Needs: a symbol -> {ExchangeSegment, SecurityId} map (from Dhan's instrument master CSV).
// Output tick shape must match feeds/mock.js: { s, ltp, ch, chp, o, h, l, c, v, ts }.
// Check Dhan's current API docs before implementing; request codes and packet layouts are versioned.

export async function createFeed() {
  throw new Error('Dhan feed is not implemented yet. Set FEED=mock in ticker/.env for now.');
}
