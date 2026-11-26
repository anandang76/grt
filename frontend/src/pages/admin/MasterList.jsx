import { useEffect, useState } from 'react';
import WatchlistEditor from '../../components/WatchlistEditor';
import { Alert, Loading } from '../../components/ui';
import { useSubmit } from '../../lib/hooks';
import { clearInstrumentsCache, getMasterList, saveMasterList } from '../../lib/watchlist';

/**
 * Admin: the weekly master list. Pick up to 10 scripts for the dry run — only these stream live
 * and are selectable by users. Saving prunes every user's watchlist down to the chosen set.
 */
export default function MasterList() {
  const [data, setData] = useState(null);
  const [done, setDone] = useState('');
  const s = useSubmit();

  useEffect(() => { getMasterList().then(setData).catch(() => setData({ symbols: [], instruments: [], groups: {}, max: 10 })); }, []);

  const save = (symbols) =>
    s.run(async () => {
      const r = await saveMasterList(symbols);
      clearInstrumentsCache();
      setData((d) => ({ ...d, symbols: r.symbols }));
      setDone(r.symbols.length ? `Master list saved — ${r.symbols.length} script${r.symbols.length === 1 ? '' : 's'} active this week.` : 'Master list cleared — all instruments are selectable again.');
    });

  if (data === null) return <Loading />;

  // Make the editor draw from the full universe (not the restricted /instruments list).
  const fetcher = () => Promise.resolve({ instruments: data.instruments, groups: data.groups, max: data.max });

  return (
    <div className="card">
      <h1>Master list</h1>
      <p className="sub">Choose up to {data.max} scripts for this week’s run. Users can only build their watchlist from these, and the terminal streams only these — so the live feed never exceeds {data.max} instruments. Clearing the list makes the full universe selectable again.</p>
      {done && <Alert type="ok">{done}</Alert>}
      <WatchlistEditor key={data.symbols.join(',')} initial={data.symbols} fetcher={fetcher} onSave={save} saving={s.busy} error={s.error} saveLabel="Save master list" />
    </div>
  );
}
