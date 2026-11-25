import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Field, Loading } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useSubmit } from '../lib/hooks';
import { getDhanStatus, saveDhanToken } from '../lib/watchlist';

export default function Broker() {
  const [dhan, setDhan] = useState(null);
  const [token, setToken] = useState('');
  const [ok, setOk] = useState(null);
  const s = useSubmit();

  const load = () => getDhanStatus().then((r) => setDhan(r.dhan)).catch(() => setDhan(false));
  useEffect(() => { load(); }, []);

  const submit = (e) => {
    e.preventDefault();
    setOk(null);
    s.run(async () => {
      const r = await saveDhanToken(token.trim());
      setDhan(r.dhan);
      setToken('');
      setOk(r.message);
    });
  };

  if (dhan === null) return <Loading />;

  return (
    <div className="card stack" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div>
        <h1>Dhan API token</h1>
        <p className="sub" style={{ margin: 0 }}>One shared token for all users. It expires daily, so paste a fresh token each trading day.</p>
      </div>

      <div className="card" style={{ background: 'var(--bg)' }}>
        <div className="kv-row">
          <span className="muted">Status</span>
          {dhan && dhan.configured
            ? <Badge value={dhan.stale ? 'pending' : 'active'} label={dhan.stale ? 'Needs today’s token' : 'Set for today'} />
            : <Badge value="inactive" label="Not set" />}
        </div>
        {dhan && dhan.configured && (
          <>
            <div className="kv-row"><span className="muted">Token</span><code className="temp">{dhan.masked}</code></div>
            <div className="kv-row"><span className="muted">Updated</span><span>{fmtDate(dhan.updated_at)}{dhan.updated_by ? ` · by ${dhan.updated_by}` : ''}</span></div>
          </>
        )}
      </div>

      <Alert type="ok">{ok}</Alert>
      <form onSubmit={submit} noValidate>
        <Field label="New token" id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste today's Dhan access token" error={s.errors.token || s.error} autoComplete="off" />
        <Button className="btn-block" busy={s.busy} disabled={token.trim().length < 20}>Save token</Button>
      </form>
      <p className="hint">Generate the token from your Dhan account (Profile → DhanHQ Trading APIs → Access Token). Live market data and orders use this token.</p>
    </div>
  );
}
