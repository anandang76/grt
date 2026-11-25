import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

// Pull the current theme colours from the app's CSS variables so the chart matches
// light/dark mode exactly.
function themeColors() {
  const s = getComputedStyle(document.body);
  const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback);
  return {
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
  for (const b of bars) {
    const time = Number(b.ts_epoch);
    candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close });
    const hasStop = b.atr_trailing_stop != null;
    longStop.push({ time, value: hasStop && b.ut_bot_position === 1 ? Number(b.atr_trailing_stop) : NaN });
    shortStop.push({ time, value: hasStop && b.ut_bot_position === -1 ? Number(b.atr_trailing_stop) : NaN });
  }
  return { candles, longStop, shortStop };
}

function markers(bars, c) {
  const out = [];
  for (const b of bars) {
    if (b.ut_bot_signal === 'BUY') out.push({ time: Number(b.ts_epoch), position: 'belowBar', color: c.up, shape: 'arrowUp', text: 'BUY' });
    else if (b.ut_bot_signal === 'SELL') out.push({ time: Number(b.ts_epoch), position: 'aboveBar', color: c.down, shape: 'arrowDown', text: 'SELL' });
  }
  return out;
}

export default function Chart({ bars, height = 360, label = '' }) {
  const elRef = useRef(null);
  const legendRef = useRef(null);
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
      autoSize: false,
      layout: { background: { color: 'transparent' }, textColor: c.text, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.grid, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: c.grid, timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 7, minBarSpacing: 2 },
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
      priceLineVisible: true, priceLineStyle: LineStyle.Dashed, priceLineColor: c.text, lastValueVisible: true,
    });
    const longStop = chart.addLineSeries({ color: c.pri, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const shortStop = chart.addLineSeries({ color: c.warn, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    const data = seriesData(bars);
    candle.setData(data.candles);
    longStop.setData(data.longStop);
    shortStop.setData(data.shortStop);
    candle.setMarkers(markers(bars, c));
    chart.timeScale().fitContent();

    const renderLegend = (b) => {
      const lg = legendRef.current;
      if (!lg || !b) return;
      const prev = bars[bars.indexOf(b) - 1];
      const base = prev ? prev.close : b.open;
      const chg = b.close - base;
      const chgp = base ? (chg / base) * 100 : 0;
      const col = b.close >= b.open ? c.up : c.down;
      lg.innerHTML =
        `<b>${label}</b>` +
        `<span>O <b style="color:${col}">${b.open.toFixed(2)}</b></span>` +
        `<span>H <b style="color:${col}">${b.high.toFixed(2)}</b></span>` +
        `<span>L <b style="color:${col}">${b.low.toFixed(2)}</b></span>` +
        `<span>C <b style="color:${col}">${b.close.toFixed(2)}</b></span>` +
        `<span style="color:${chg >= 0 ? c.up : c.down}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${chgp.toFixed(2)}%)</span>`;
    };
    renderLegend(bars[bars.length - 1]);

    const byTime = new Map(bars.map((b) => [Number(b.ts_epoch), b]));
    chart.subscribeCrosshairMove((p) => {
      const b = p?.time != null ? byTime.get(Number(p.time)) : null;
      renderLegend(b || bars[bars.length - 1]);
    });

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [bars, height, label, theme]);

  if (!bars.length) return <div className="empty">No data for this symbol.</div>;
  return (
    <div className="chartWrap" style={{ height }}>
      <div className="chartLegend" ref={legendRef} />
      <div className="chartCanvas" ref={elRef} />
    </div>
  );
}
