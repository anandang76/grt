import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WatchlistEditor from '../components/WatchlistEditor';
import { Loading } from '../components/ui';
import { useSubmit } from '../lib/hooks';
import { getWatchlist, saveWatchlist } from '../lib/watchlist';

export default function Watchlist() {
  const nav = useNavigate();
  const [initial, setInitial] = useState(null);
  const s = useSubmit();

  useEffect(() => { getWatchlist().then((r) => setInitial(r.watchlist)).catch(() => setInitial([])); }, []);

  const save = (symbols) =>
    s.run(async () => {
      await saveWatchlist(symbols);
      nav('/home', { state: { flash: { type: 'ok', msg: 'Watchlist updated.' } } });
    });

  if (initial === null) return <Loading />;

  return (
    <div className="card">
      <h1>Configure watchlist</h1>
      <p className="sub">Choose up to 10 NIFTY 50 stocks for your left menu. Each shows 1-min and 5-min charts with buy/sell signals.</p>
      <WatchlistEditor initial={initial} onSave={save} onCancel={() => nav('/home')} saving={s.busy} error={s.error} />
    </div>
  );
}
