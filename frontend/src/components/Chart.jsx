import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

// Pull the current theme colours from the app's CSS variables so the chart matches
// light/dark mode exactly.
function themeColors() {
  const s = getComputedStyle(document.body);
  const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback);
  return {
    bg: v('--card', '#ffffff'),
    text: v('--muted', '#5f6673'),
    grid: v('--line', '#e3e6eb'),
    up: v('--ok', '#0b8a4c'),
    down: v('--err', '#d0342c'),
    pri: v('--pri', '#2563eb'),
    warn: v('--warn', '#a35f00'),
  };
}

function seriesData(bars) {
  const candles = [];
  const longStop = [];
  const shortStop = [];
  const volume = [];
  const { up, down } = themeColors();
  for (const b of bars) {
    const time = Number(b.ts_epoch);
    candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close });
    const hasStop = b.atr_trailing_stop != null;
    longStop.push({ time, value: hasStop && b.ut_bot_position === 1 ? Number(b.atr_trailing_stop) : NaN });
    shortStop.push({ time, value: hasStop && b.ut_bot_position === -1 ? Number(b.atr_trailing_stop) : NaN });
    volume.push({ time, value: b.volume || 0, color: (b.close >= b.open ? up : down) + '44' });
  }
  return { candles, longStop, shortStop, volume };
}

function markers(bars, c) {
  const out = [];
  for (const b of bars) {
    if (b.ut_bot_signal === 'BUY') out.push({ time: Number(b.ts_epoch), position: 'belowBar', color: c.up, shape: 'arrowUp', text: 'BUY' });
    else if (b.ut_bot_signal === 'SELL') out.push({ time: Number(b.ts_epoch), position: 'aboveBar', color: c.down, shape: 'arrowDown', text: 'SELL' });
  }
  return out;
}

export default function Chart({ bars, height = 300 }) {
  const elRef = useRef(null);
  const tipRef = useRef(null);
  const [theme, setTheme] = useState(0); // bump to force re-render on scheme change

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const bump = () => setTheme((t) => t + 1);
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !bars.length) return undefined;
    const c = themeColors();

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: c.text, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.grid, scaleMargins: { top: 0.1, bottom: 0.22 } },
      timeScale: { borderColor: c.grid, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6, minBarSpacing: 1.5 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: c.text, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.pri },
        horzLine: { color: c.text, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.pri },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const candle = chart.addCandlestickSeries({
      upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down,
      priceLineVisible: false,
    });
    const longStop = chart.addLineSeries({ color: c.pri, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const shortStop = chart.addLineSeries({ color: c.warn, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 }, borderVisible: false });

    const data = seriesData(bars);
    candle.setData(data.candles);
    longStop.setData(data.longStop);
    shortStop.setData(data.shortStop);
    volume.setData(data.volume);
    candle.setMarkers(markers(bars, c));
    chart.timeScale().fitContent();

    const byTime = new Map(bars.map((b) => [Number(b.ts_epoch), b]));
    chart.subscribeCrosshairMove((p) => {
      const tip = tipRef.current;
      if (!tip) return;
      const b = p?.time != null ? byTime.get(Number(p.time)) : null;
      if (!b) { tip.style.display = 'none'; return; }
      const when = new Date(b.datetime_ist).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      tip.innerHTML =
        `<b>${when}</b> &nbsp; O ${b.open} &nbsp; H ${b.high} &nbsp; L ${b.low} &nbsp; C <b>${b.close}</b>` +
        (b.ut_bot_signal ? ` &nbsp; <b style="color:${b.ut_bot_signal === 'BUY' ? c.up : c.down}">${b.ut_bot_signal}</b>` : '');
      tip.style.display = 'block';
    });

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [bars, height, theme]);

  if (!bars.length) return <div className="empty">No data for this symbol.</div>;
  return (
    <div className="chartWrap">
      <div ref={elRef} />
      <div className="chartTip" ref={tipRef} />
    </div>
  );
}
