import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Live ticks from the Node tick service.
 * Gets a short-lived token from Laravel, connects over WebSocket, subscribes to `symbols`,
 * and reconnects with backoff. Updates are batched to one render per animation frame.
 */
export function useTicker(symbols) {
  const [ticks, setTicks] = useState({});
  const [status, setStatus] = useState('connecting'); // connecting | live | offline
  const [demo, setDemo] = useState(false);
  const key = symbols.join('|');
  const pending = useRef({});

  useEffect(() => {
    let ws;
    let closed = false;
    let retry = 0;
    let timer;
    let frame;

    const flush = () => {
      frame = null;
      const batch = pending.current;
      pending.current = {};
      setTicks((prev) => ({ ...prev, ...batch }));
    };

    const schedule = () => {
      if (closed) return;
      setStatus('offline');
      timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };

    async function connect() {
      try {
        const { token, url } = await api('/ticker/token');
        if (closed) return;
        ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
        ws.onopen = () => {
          retry = 0;
          setStatus('live');
          ws.send(JSON.stringify({ op: 'sub', symbols }));
        };
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.t === 'hello') setDemo(!!m.demo);
          else if (m.t === 'tick') {
            pending.current[m.d.s] = m.d;
            if (!frame) frame = requestAnimationFrame(flush);
          }
        };
        ws.onclose = schedule;
      } catch {
        schedule();
      }
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ticks, status, demo };
}
