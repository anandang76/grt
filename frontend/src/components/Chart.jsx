import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

// lightweight-charts renders time in UTC; format axis + crosshair in IST instead.
const IST = 'Asia/Kolkata';
const istTime = (t) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST }).format(new Date(t * 1000));
const istDate = (t) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: IST }).format(new Date(t * 1000));
const istFull = (t) => `${istDate(t)} ${istTime(t)}`;
// tickMarkType: 0 Year, 1 Month, 2 DayOfMonth, 3+ Time
const istTick = (t, type) => (type <= 2 ? istDate(t) : istTime(t));

// Theme colours pulled from the app's CSS variables so the chart matches light/dark mode.
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

export default function Chart({ bars, height = 420, label = '', tag = '', expanded = false, onToggleExpand = null }) {
  const elRef = useRef(null);
  const legendRef = useRef(null);
  const chartRef = useRef(null);
  const series = useRef(null);
  const [theme, setTheme] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const bump = () => setTheme((t) => t + 1);
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, []);

  const renderLegend = (b, c) => {
    const lg = legendRef.current;
    if (!lg || !b) return;
    const col = b.close >= b.open ? c.up : c.down;
    lg.innerHTML =
      `<b>${label}</b>` +
      `<span>O <b style="color:${col}">${b.open.toFixed(2)}</b></span>` +
      `<span>H <b style="color:${col}">${b.high.toFixed(2)}</b></span>` +
      `<span>L <b style="color:${col}">${b.low.toFixed(2)}</b></span>` +
      `<span>C <b style="color:${col}">${b.close.toFixed(2)}</b></span>`;
  };

  // Create the chart once per symbol/size/theme. Live data updates happen in the effect below
  // without recreating, so the user's zoom/pan is preserved.
  useEffect(() => {
    const el = elRef.current;
    if (!el || !bars.length) return undefined; // wait for data (it may load async)
    const c = themeColors();

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: c.text, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' },
      localization: { timeFormatter: istFull },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.grid, scaleMargins: { top: 0.1, bottom: 0.08 }, autoScale: true },
      timeScale: { borderColor: c.grid, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 8, minBarSpacing: 1, tickMarkFormatter: istTick },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: c.text, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.pri },
        horzLine: { color: c.text, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.pri },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
      kineticScroll: { touch: true, mouse: false },
    });

    const candle = chart.addCandlestickSeries({
      upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down,
      priceLineVisible: true, priceLineStyle: LineStyle.Dashed, priceLineWidth: 1, lastValueVisible: true,
    });
    const longStop = chart.addLineSeries({ color: c.pri, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const shortStop = chart.addLineSeries({ color: c.warn, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    const data = seriesData(bars);
    candle.setData(data.candles);
    longStop.setData(data.longStop);
    shortStop.setData(data.shortStop);
    candle.setMarkers(markers(bars, c));
    chart.timeScale().fitContent();
    renderLegend(bars[bars.length - 1], c);

    chart.subscribeCrosshairMove((p) => {
      const b = p?.time != null ? series.current?.byTime.get(Number(p.time)) : null;
      renderLegend(b || series.current?.bars[series.current.bars.length - 1], c);
    });

    chartRef.current = chart;
    series.current = { candle, longStop, shortStop, c, bars, byTime: new Map(bars.map((b) => [Number(b.ts_epoch), b])) };

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; series.current = null; };
    // recreate when data first appears (bars may load async) or symbol/size/theme change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, height, theme, bars.length > 0]);

  // Live/incremental data updates — keep the current view, just refresh the data.
  useEffect(() => {
    const s = series.current;
    if (!s || !bars.length) return;
    const data = seriesData(bars);
    s.candle.setData(data.candles);
    s.longStop.setData(data.longStop);
    s.shortStop.setData(data.shortStop);
    s.candle.setMarkers(markers(bars, s.c));
    s.bars = bars;
    s.byTime = new Map(bars.map((b) => [Number(b.ts_epoch), b]));
    renderLegend(bars[bars.length - 1], s.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  const zoom = (factor) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const bs = ts.options().barSpacing || 8;
    ts.applyOptions({ barSpacing: Math.max(1, Math.min(60, bs * factor)) });
  };

  // The container is always rendered so the chart can attach once data loads (sync or async).
  return (
    <div className="chartWrap" style={{ height }}>
      <div className="chartLegend" ref={legendRef} />
      <div className="chart-ctl">
        {tag && bars.length > 0 && <span className="demo-tag">{tag}</span>}
        {onToggleExpand && (
          <button type="button" className="chart-expand" onClick={onToggleExpand} aria-label={expanded ? 'Show both charts' : 'Expand this chart'} title={expanded ? 'Show both charts' : 'Expand this chart'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {expanded
                ? <><path d="M9 3H3v6" /><path d="M3 3l7 7" /><path d="M15 21h6v-6" /><path d="M21 21l-7-7" /></>
                : <><path d="M15 3h6v6" /><path d="M21 3l-7 7" /><path d="M9 21H3v-6" /><path d="M3 21l7-7" /></>}
            </svg>
          </button>
        )}
      </div>
      <div className="chartCanvas" ref={elRef} />
      {bars.length === 0 && <div className="chart-empty">No stored data yet — pull it in Admin → History data.</div>}
      {bars.length > 0 && (
        <div className="chartZoom">
          <button type="button" onClick={() => zoom(1 / 1.3)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => zoom(1.3)} aria-label="Zoom in">+</button>
        </div>
      )}
    </div>
  );
}
