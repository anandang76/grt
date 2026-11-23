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

/* ---------- Subscriptions ---------- */
const subscribers = new Map(); // symbol -> Set<ws>
const lastTick = new Map(); // symbol -> tick

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function onTick(tick) {
  lastTick.set(tick.s, tick);
  const set = subscribers.get(tick.s);
  if (!set) return;
  const msg = JSON.stringify({ t: 'tick', d: tick });
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}

const { createFeed } = await import(`./feeds/${FEED.replace(/[^a-z]/g, '')}.js`);
const feed = await createFeed({ onTick, log });
log(`feed "${FEED}" ready`);

function subscribe(ws, symbols) {
  const fresh = [];
  for (const raw of symbols) {
    const s = String(raw).toUpperCase().slice(0, 40);
    if (ws.symbols.has(s)) continue;
    if (ws.symbols.size >= MAX_SYMBOLS) return send(ws, { t: 'error', m: `Max ${MAX_SYMBOLS} symbols per connection` });
    ws.symbols.add(s);
    if (!subscribers.has(s)) {
      subscribers.set(s, new Set());
      fresh.push(s);
    }
    subscribers.get(s).add(ws);
    if (lastTick.has(s)) send(ws, { t: 'tick', d: lastTick.get(s) });
  }
  if (fresh.length) feed.subscribe(fresh);
}

function unsubscribe(ws, symbols) {
  const gone = [];
  for (const raw of symbols) {
    const s = String(raw).toUpperCase();
    if (!ws.symbols.delete(s)) continue;
    const set = subscribers.get(s);
    set?.delete(ws);
    if (set && set.size === 0) {
      subscribers.delete(s);
      gone.push(s);
    }
  }
  if (gone.length) feed.unsubscribe(gone);
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
  ws.symbols = new Set();
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf);
    } catch {
      return send(ws, { t: 'error', m: 'Bad JSON' });
    }
    const symbols = Array.isArray(msg.symbols) ? msg.symbols : [];
    if (msg.op === 'sub') subscribe(ws, symbols);
    else if (msg.op === 'unsub') unsubscribe(ws, symbols);
  });
  ws.on('close', () => unsubscribe(ws, [...ws.symbols]));
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
