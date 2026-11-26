// GR Trading tick service.
// Browsers connect to ws://host:PORT/ws?token=<JWT from Laravel /api/ticker/token>,
// then send {op:"sub", symbols:[...]} / {op:"unsub", symbols:[...]}.
// One upstream broker feed is shared by all clients (fan-out).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

loadEnv(new URL('./.env', import.meta.url));

const PORT = Number(process.env.PORT || 8090);
const SECRET = process.env.TICKER_SECRET || '';
const FEED = process.env.FEED || 'mock';
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_SYMBOLS = 200;

if (!SECRET) {
  console.error('TICKER_SECRET is missing (must match backend/.env).');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- Auth: HS256 JWT issued by Laravel ---------- */
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    return claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}

/* ---------- Subscriptions ----------
 * A client subscribes underlyings by symbol ({op:'sub', symbols:[...]}) and option strikes /
 * the depth card by explicit descriptor ({op:'sub', instruments:[{s, segment, securityId, mode}]}).
 * `mode` is 'ticker' (LTP) or 'full' (adds 5-level depth). Each instrument is subscribed upstream
 * once at the strongest mode any connected client wants, and fanned out to all of them.
 */
const subscribers = new Map(); // key -> Set<ws>
const desc = new Map();        // key -> { segment, securityId } (options only)
const lastTick = new Map();    // key -> tick
const lastDepth = new Map();   // key -> depth

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Strongest mode any current subscriber wants for this key.
function effective(key) {
  const set = subscribers.get(key);
  if (set) for (const ws of set) if (ws.subs.get(key) === 'full') return 'full';
  return 'ticker';
}

function fanout(key, msg) {
  const set = subscribers.get(key);
  if (!set) return;
  const s = JSON.stringify(msg);
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(s);
}

function onTick(tick) {
  lastTick.set(tick.s, tick);
  fanout(tick.s, { t: 'tick', d: tick });
}

function onDepth(d) {
  if (!d.s) return;
  lastDepth.set(d.s, d);
  fanout(d.s, { t: 'depth', d });
}

const { createFeed } = await import(`./feeds/${FEED.replace(/[^a-z]/g, '')}.js`);
const feed = await createFeed({ onTick, onDepth, log });
log(`feed "${FEED}" ready`);

// Normalise a sub/unsub message into [{ key, segment?, securityId?, mode }].
function items(msg) {
  const out = [];
  for (const raw of Array.isArray(msg.symbols) ? msg.symbols : []) {
    const key = String(raw).toUpperCase().slice(0, 40);
    if (key) out.push({ key, mode: 'ticker' });
  }
  for (const it of Array.isArray(msg.instruments) ? msg.instruments : []) {
    const key = String(it.s).toUpperCase().slice(0, 40);
    if (key) out.push({ key, segment: it.segment, securityId: it.securityId, mode: it.mode === 'full' ? 'full' : 'ticker' });
  }
  return out;
}

function subscribe(ws, list) {
  for (const it of list) {
    if (!ws.subs.has(it.key) && ws.subs.size >= MAX_SYMBOLS) { send(ws, { t: 'error', m: `Max ${MAX_SYMBOLS} instruments per connection` }); break; }
    if (!subscribers.has(it.key)) subscribers.set(it.key, new Set());
    subscribers.get(it.key).add(ws);
    ws.subs.set(it.key, it.mode);
    if (it.segment && it.securityId != null) desc.set(it.key, { segment: it.segment, securityId: it.securityId });
    feed.ensure(it.key, { ...desc.get(it.key), mode: effective(it.key) }); // idempotent; upgrades if needed
    if (lastTick.has(it.key)) send(ws, { t: 'tick', d: lastTick.get(it.key) });
    if (lastDepth.has(it.key)) send(ws, { t: 'depth', d: lastDepth.get(it.key) });
  }
}

function unsubscribe(ws, keys) {
  for (const key of keys) {
    if (!ws.subs.delete(key)) continue;
    const set = subscribers.get(key);
    set?.delete(ws);
    if (set && set.size === 0) {
      subscribers.delete(key);
      desc.delete(key);
      lastDepth.delete(key);
      feed.remove(key);
    } else {
      feed.ensure(key, { ...desc.get(key), mode: effective(key) }); // may downgrade full -> ticker
    }
  }
}

/* ---------- Servers ---------- */
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, feed: FEED, clients: wss.clients.size, symbols: subscribers.size }));
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 16 * 1024,
  verifyClient: ({ origin, req }, done) => {
    if (ORIGINS.length && origin && !ORIGINS.includes(origin)) return done(false, 403, 'Origin not allowed');
    const claims = verifyToken(new URL(req.url, 'http://x').searchParams.get('token'));
    if (!claims) return done(false, 401, 'Invalid or expired token');
    req.claims = claims;
    done(true);
  },
});

wss.on('connection', (ws, req) => {
  ws.user = req.claims.sub;
  ws.subs = new Map(); // key -> mode
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf);
    } catch {
      return send(ws, { t: 'error', m: 'Bad JSON' });
    }
    if (msg.op === 'sub') subscribe(ws, items(msg));
    else if (msg.op === 'unsub') unsubscribe(ws, items(msg).map((it) => it.key));
  });
  ws.on('close', () => unsubscribe(ws, [...ws.subs.keys()]));
  send(ws, { t: 'hello', feed: FEED, demo: FEED === 'mock' });
});

// Drop dead connections.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    else {
      ws.alive = false;
      ws.ping();
    }
  }
}, 30_000);

server.listen(PORT, () => log(`tick service on ws://localhost:${PORT}/ws`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    feed.close?.();
    wss.close();
    server.close(() => process.exit(0));
  });
}

/* ---------- tiny .env loader (Node 18 has no --env-file) ---------- */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
