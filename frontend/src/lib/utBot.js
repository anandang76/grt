// UT Bot Alerts port (Key Value=1, ATR Period=10), from the dhan5/dhan6 projects
// (indicators_ut.py / ut_bot_core.py). Produces the ATR trailing stop, position, and
// BUY/SELL signals shown on the charts. When real Dhan data is wired in, the backend
// supplies these fields and this is only used for demo candles.

export function wilderATR(bars, period) {
  const atr = new Array(bars.length).fill(null);
  let trSum = 0;
  for (let i = 0; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = i > 0 ? bars[i - 1].close : bars[i].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    if (i < period) {
      trSum += tr;
      if (i === period - 1) atr[i] = trSum / period;
    } else {
      atr[i] = (atr[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atr;
}

export function computeUTBot(bars, keyValue = 1, atrPeriod = 10) {
  const atr = wilderATR(bars, atrPeriod);
  const stop = new Array(bars.length).fill(null);
  const pos = new Array(bars.length).fill(0);
  const sig = new Array(bars.length).fill(null);
  for (let i = 0; i < bars.length; i++) {
    if (atr[i] == null) continue;
    const nLoss = keyValue * atr[i];
    const src = bars[i].close;
    if (stop[i - 1] == null) {
      stop[i] = src - nLoss;
      continue;
    }
    const prevStop = stop[i - 1];
    const prevSrc = bars[i - 1].close;
    if (src > prevStop && prevSrc > prevStop) stop[i] = Math.max(prevStop, src - nLoss);
    else if (src < prevStop && prevSrc < prevStop) stop[i] = Math.min(prevStop, src + nLoss);
    else if (src > prevStop) stop[i] = src - nLoss;
    else stop[i] = src + nLoss;

    if (prevSrc < prevStop && src > stop[i]) pos[i] = 1;
    else if (prevSrc > prevStop && src < stop[i]) pos[i] = -1;
    else pos[i] = pos[i - 1];

    const above = prevSrc <= prevStop && src > stop[i];
    const below = prevSrc >= prevStop && src < stop[i];
    if (src > stop[i] && above) sig[i] = 'BUY';
    else if (src < stop[i] && below) sig[i] = 'SELL';
  }
  return bars.map((b, i) => ({
    ...b,
    atr_trailing_stop: stop[i],
    ut_bot_position: pos[i],
    ut_bot_signal: sig[i],
  }));
}
