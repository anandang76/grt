// Is the given instrument's market open right now (IST)?
// MCX commodities trade into the evening; NSE/BSE equities & indices 09:15–15:30.
export function marketOpen(kind) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  const m = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
  if (kind === 'commodity') return m >= 540 && m <= 1410; // 09:00–23:30
  return m >= 555 && m <= 930; // 09:15–15:30
}
