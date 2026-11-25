// Dhan v2 live market feed (FEED=dhan). Read-only market data — no static IP needed.
//
// Connects to wss://api-feed.dhan.co, subscribes to our instruments by securityId, parses the
// little-endian binary packets, and emits { s, ltp, ts } ticks. One shared upstream connection
// fans out to all browser clients (handled by server.js).
//
// Credentials + the symbol→securityId map come from the Laravel backend (/api/ticker/feed-config),
// authenticated by TICKER_SECRET, and are refreshed periodically to pick up the daily token.
import WebSocket from 'ws';

const SEG_NUM = { IDX_I: 0, NSE_EQ: 1, NSE_FNO: 2, NSE_CURRENCY: 3, BSE_EQ: 4, MCX_COMM: 5, BSE_CURRENCY: 7, BSE_FNO: 8 };
const SUB = 15;   // subscribe: ticker packet (LTP)
const UNSUB = 16; // unsubscribe: ticker packet

export async function createFeed({ onTick, log }) {
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  const secret = process.env.TICKER_SECRET || '';

  let cfg = { token: null, clientId: null, instruments: {} };
  let bySecId = new Map(); // "segNum:securityId" -> symbol
  let ws = null;
  const wanted = new Set();
  let reconnectTimer = null;
  let debugLeft = 6; // log first few packets to confirm parsing

  async function fetchConfig() {
    const r = await fetch(`${backend}/api/ticker/feed-config`, { headers: { 'X-Ticker-Secret': secret, Accept: 'application/json' } });
    if (!r.ok) throw new Error('feed-config HTTP ' + r.status);
    cfg = await r.json();
    bySecId = new Map();
    for (const [sym, m] of Object.entries(cfg.instruments || {})) {
      bySecId.set(`${SEG_NUM[m.segment]}:${m.securityId}`, sym);
    }
  }

  function instrumentList(symbols) {
    const list = [];
    for (const s of symbols) {
      const m = cfg.instruments[s];
      if (m) list.push({ ExchangeSegment: m.segment, SecurityId: String(m.securityId) });
    }
    return list;
  }

  function send(code, symbols) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    const list = instrumentList(symbols);
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      ws.send(JSON.stringify({ RequestCode: code, InstrumentCount: chunk.length, InstrumentList: chunk }));
    }
  }

  function connect() {
    if (!cfg.token || !cfg.clientId) { log('dhan feed: no Dhan token set; will retry'); return scheduleReconnect(15000); }
    const url = `wss://api-feed.dhan.co?version=2&token=${encodeURIComponent(cfg.token)}&clientId=${encodeURIComponent(cfg.clientId)}&authType=2`;
    ws = new WebSocket(url);
    ws.on('open', () => { log('dhan feed connected'); if (wanted.size) send(SUB, [...wanted]); });
    ws.on('message', (buf) => parse(buf));
    ws.on('close', (c) => { log('dhan feed closed', c); scheduleReconnect(5000); });
    ws.on('error', (e) => log('dhan feed error', e.message));
  }

  function scheduleReconnect(ms) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => { try { await fetchConfig(); } catch (e) { log('config:', e.message); } connect(); }, ms);
  }

  // Walk concatenated packets. Header (8 bytes, little-endian): [0] code, [1-2] msgLen(int16),
  // [3] segment, [4-7] securityId. Ticker/Index packets carry LTP (float32) at offset 8.
  function parse(buf) {
    let off = 0;
    while (off + 8 <= buf.length) {
      const code = buf.readUInt8(off);
      const msgLen = buf.readUInt16LE(off + 1);
      const seg = buf.readUInt8(off + 3);
      const secId = buf.readInt32LE(off + 4);

      if ((code === 1 || code === 2) && off + 12 <= buf.length) {
        const ltp = buf.readFloatLE(off + 8);
        const sym = bySecId.get(`${seg}:${secId}`);
        if (debugLeft > 0) { log(`pkt code=${code} len=${msgLen} seg=${seg} sid=${secId} ltp=${ltp} -> ${sym || '?'}`); debugLeft--; }
        if (sym && ltp > 0) onTick({ s: sym, ltp: +ltp.toFixed(2), ts: Date.now() });
      } else if (code === 50) {
        log('dhan feed disconnect code', off + 10 <= buf.length ? buf.readInt16LE(off + 8) : '?');
      }

      const adv = msgLen >= 8 ? msgLen : 8; // msgLen is the full packet size
      off += adv;
    }
  }

  try { await fetchConfig(); } catch (e) { log('dhan feed config failed:', e.message); }
  const refresh = setInterval(() => fetchConfig().catch(() => {}), 20 * 60 * 1000);
  connect();

  return {
    subscribe(symbols) { for (const s of symbols) wanted.add(s); send(SUB, symbols); },
    unsubscribe(symbols) { for (const s of symbols) wanted.delete(s); send(UNSUB, symbols); },
    close() { clearTimeout(reconnectTimer); clearInterval(refresh); ws?.close(); },
  };
}
