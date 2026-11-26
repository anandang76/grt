// Dhan v2 live market feed (FEED=dhan). Read-only market data — no static IP needed.
//
// Connects to wss://api-feed.dhan.co and keeps a registry of subscribed instruments. Underlyings
// (watchlist symbols) are subscribed in "ticker" mode (LTP only); option strikes and the expanded
// depth card are subscribed explicitly by securityId. "full" mode (RequestCode 21) returns the
// 5-level market depth + day OHLC used by the depth panel. One shared upstream connection fans out
// to all browser clients (handled by server.js).
//
// Credentials + the underlying symbol→securityId map come from the Laravel backend
// (/api/ticker/feed-config), authenticated by TICKER_SECRET, refreshed to pick up the daily token.
import WebSocket from 'ws';

const SEG_NUM = { IDX_I: 0, NSE_EQ: 1, NSE_FNO: 2, NSE_CURRENCY: 3, BSE_EQ: 4, MCX_COMM: 5, BSE_CURRENCY: 7, BSE_FNO: 8 };
const SUB_TICKER = 15;
const UNSUB_TICKER = 16;
const SUB_FULL = 21;
const UNSUB_FULL = 22;
const reqCode = (mode, sub) => (mode === 'full' ? (sub ? SUB_FULL : UNSUB_FULL) : (sub ? SUB_TICKER : UNSUB_TICKER));

export async function createFeed({ onTick, onDepth, log }) {
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  const secret = process.env.TICKER_SECRET || '';

  let cfg = { token: null, clientId: null, instruments: {} };
  let ws = null;
  let reconnectTimer = null;
  let debugLeft = 6;

  const reg = new Map();     // key -> { segment, segNum, securityId, mode }
  const bySecId = new Map(); // "segNum:securityId" -> key

  async function fetchConfig() {
    const r = await fetch(`${backend}/api/ticker/feed-config`, { headers: { 'X-Ticker-Secret': secret, Accept: 'application/json' } });
    if (!r.ok) throw new Error('feed-config HTTP ' + r.status);
    cfg = await r.json();
  }

  // Resolve a key to {segment, securityId}: use explicit values (options), else the underlying map.
  function resolve(key, segment, securityId) {
    if (segment && securityId != null) return { segment, securityId: String(securityId) };
    const m = cfg.instruments?.[key];
    return m ? { segment: m.segment, securityId: String(m.securityId) } : null;
  }

  function wsSend(mode, sub, items) {
    if (!ws || ws.readyState !== ws.OPEN || !items.length) return;
    const list = items.map((r) => ({ ExchangeSegment: r.segment, SecurityId: String(r.securityId) }));
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      ws.send(JSON.stringify({ RequestCode: reqCode(mode, sub), InstrumentCount: chunk.length, InstrumentList: chunk }));
    }
  }

  // Subscribe everything in the registry (used on (re)connect), grouped by mode.
  function subscribeAll() {
    const byMode = { ticker: [], full: [] };
    for (const r of reg.values()) byMode[r.mode].push(r);
    wsSend('ticker', true, byMode.ticker);
    wsSend('full', true, byMode.full);
  }

  function connect() {
    if (!cfg.token || !cfg.clientId) { log('dhan feed: no Dhan token set; will retry'); return scheduleReconnect(15000); }
    const url = `wss://api-feed.dhan.co?version=2&token=${encodeURIComponent(cfg.token)}&clientId=${encodeURIComponent(cfg.clientId)}&authType=2`;
    ws = new WebSocket(url);
    ws.on('open', () => { log('dhan feed connected'); subscribeAll(); });
    ws.on('message', (buf) => parse(buf));
    ws.on('close', (c) => { log('dhan feed closed', c); scheduleReconnect(5000); });
    ws.on('error', (e) => log('dhan feed error', e.message));
  }

  function scheduleReconnect(ms) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => { try { await fetchConfig(); } catch (e) { log('config:', e.message); } connect(); }, ms);
  }

  // Header (8 bytes, little-endian): [0] code, [1-2] msgLen, [3] segment, [4-7] securityId.
  //  code 1/2  -> ticker/index LTP (float32 @ offset 8)
  //  code 8    -> full packet: LTP + day OHLC + 5-level depth
  function parse(buf) {
    let off = 0;
    while (off + 8 <= buf.length) {
      const code = buf.readUInt8(off);
      const msgLen = buf.readUInt16LE(off + 1);
      const seg = buf.readUInt8(off + 3);
      const secId = buf.readInt32LE(off + 4);
      const sym = bySecId.get(`${seg}:${secId}`);

      if ((code === 1 || code === 2) && off + 12 <= buf.length) {
        const ltp = buf.readFloatLE(off + 8);
        if (debugLeft > 0) { log(`pkt code=${code} seg=${seg} sid=${secId} ltp=${ltp} -> ${sym || '?'}`); debugLeft--; }
        if (sym && ltp > 0) onTick({ s: sym, ltp: +ltp.toFixed(2), ts: Date.now() });
      } else if (code === 8 && off + 162 <= buf.length) {
        const ltp = buf.readFloatLE(off + 8);
        const d = {
          s: sym,
          ltp: +ltp.toFixed(2),
          vol: buf.readInt32LE(off + 22),
          open: +buf.readFloatLE(off + 46).toFixed(2),
          prevClose: +buf.readFloatLE(off + 50).toFixed(2),
          high: +buf.readFloatLE(off + 54).toFixed(2),
          low: +buf.readFloatLE(off + 58).toFixed(2),
          bid: [],
          ask: [],
          ts: Date.now(),
        };
        let p = off + 62;
        for (let i = 0; i < 5; i++) {
          d.bid.push({ q: buf.readInt32LE(p), o: buf.readInt16LE(p + 8), p: +buf.readFloatLE(p + 12).toFixed(2) });
          d.ask.push({ q: buf.readInt32LE(p + 4), o: buf.readInt16LE(p + 10), p: +buf.readFloatLE(p + 16).toFixed(2) });
          p += 20;
        }
        if (debugLeft > 0) { log(`full seg=${seg} sid=${secId} ltp=${ltp} -> ${sym || '?'} bid0=${d.bid[0].p}`); debugLeft--; }
        if (sym) { onDepth?.(d); if (ltp > 0) onTick({ s: sym, ltp: d.ltp, ts: Date.now() }); }
      } else if (code === 50) {
        log('dhan feed disconnect code', off + 10 <= buf.length ? buf.readInt16LE(off + 8) : '?');
      }

      off += msgLen >= 8 ? msgLen : 8;
    }
  }

  try { await fetchConfig(); } catch (e) { log('dhan feed config failed:', e.message); }
  const refresh = setInterval(() => fetchConfig().catch(() => {}), 20 * 60 * 1000);
  connect();

  return {
    // Register/update one instrument's desired mode and (re)subscribe upstream if it changed.
    ensure(key, { segment, securityId, mode = 'ticker' } = {}) {
      const resolved = resolve(key, segment, securityId);
      if (!resolved) return;
      const segNum = SEG_NUM[resolved.segment];
      const existing = reg.get(key);
      if (existing && existing.mode === mode) return;
      if (existing && existing.mode !== mode) {
        wsSend(existing.mode, false, [existing]); // drop old mode
      }
      const r = { segment: resolved.segment, segNum, securityId: resolved.securityId, mode };
      reg.set(key, r);
      bySecId.set(`${segNum}:${r.securityId}`, key);
      wsSend(mode, true, [r]);
    },
    remove(key) {
      const r = reg.get(key);
      if (!r) return;
      wsSend(r.mode, false, [r]);
      reg.delete(key);
      bySecId.delete(`${r.segNum}:${r.securityId}`);
    },
    close() { clearTimeout(reconnectTimer); clearInterval(refresh); ws?.close(); },
  };
}
