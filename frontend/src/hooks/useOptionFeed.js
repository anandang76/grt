import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Live option prices + 5-level depth from the Node tick service, on a dedicated websocket (separate
 * from the watchlist feed in useTicker). `instruments` is [{ key, segment, securityId }]; every leg
 * is subscribed in "full" mode so each card has LTP + prev-close (for %) + depth without a click.
 * Subscriptions are diffed and only the deltas are sent, so the connection is never torn down as the
 * ladder re-centres.
 */
export function useOptionFeed(instruments) {
  const [ticks, setTicks] = useState({});
  const [depth, setDepth] = useState({});
  const [status, setStatus] = useState('connecting');

  const wsRef = useRef(null);
  const sentRef = useRef(new Map());   // key -> mode currently subscribed
  const desiredRef = useRef({ list: [] });
  const syncRef = useRef(() => {});
  const pending = useRef({});
  const frame = useRef(null);

  desiredRef.current = { list: instruments || [] };
  const sig = (instruments || []).map((i) => i.key).join('|');

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer;

    const flushTicks = () => {
      frame.current = null;
      const batch = pending.current;
      pending.current = {};
      setTicks((prev) => ({ ...prev, ...batch }));
    };

    const sync = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN) return;
      const { list } = desiredRef.current;
      const want = new Map();
      for (const it of list) want.set(it.key, { s: it.key, segment: it.segment, securityId: it.securityId, mode: 'full' });

      const subs = [];
      for (const [key, w] of want) {
        if (sentRef.current.get(key) !== w.mode) { subs.push(w); sentRef.current.set(key, w.mode); }
      }
      const unsub = [];
      for (const key of [...sentRef.current.keys()]) {
        if (!want.has(key)) { unsub.push({ s: key }); sentRef.current.delete(key); }
      }
      if (subs.length) ws.send(JSON.stringify({ op: 'sub', instruments: subs }));
      if (unsub.length) ws.send(JSON.stringify({ op: 'unsub', instruments: unsub }));
    };
    syncRef.current = sync;

    async function connect() {
      try {
        const { token, url } = await api('/ticker/token');
        if (closed) return;
        const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;
        ws.onopen = () => { retry = 0; setStatus('live'); sentRef.current.clear(); sync(); };
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.t === 'tick') { pending.current[m.d.s] = m.d; if (!frame.current) frame.current = requestAnimationFrame(flushTicks); }
          else if (m.t === 'depth') setDepth((prev) => ({ ...prev, [m.d.s]: m.d }));
        };
        ws.onclose = () => { wsRef.current = null; if (closed) return; setStatus('offline'); timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++)); };
      } catch {
        timer = setTimeout(connect, 2000);
      }
    }
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      if (frame.current) cancelAnimationFrame(frame.current);
      wsRef.current?.close();
      wsRef.current = null;
      sentRef.current.clear();
    };
  }, []);

  useEffect(() => { syncRef.current(); }, [sig]);

  return { ticks, depth, status };
}
