import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Field, Icon, Loading } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useSubmit } from '../lib/hooks';
import { getDhanStatus, saveDhanClientId, saveDhanToken } from '../lib/watchlist';

const PENCIL = <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>;

function EditButton({ onClick, label }) {
  return (
    <button type="button" className="edit-ico" onClick={onClick} aria-label={label} title={label}>
      <Icon d={PENCIL} size={16} />
    </button>
  );
}

function ClientIdSection({ dhan, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState(dhan.client_id || '');
  const [ok, setOk] = useState(null);
  const s = useSubmit();
  const changed = clientId.trim() && clientId.trim() !== (dhan.client_id || '');

  const submit = (e) => {
    e.preventDefault();
    s.run(async () => {
      const r = await saveDhanClientId(clientId.trim());
      onSaved(r.dhan);
      setOk(r.message);
      setEditing(false);
    });
  };

  const startEdit = () => { setClientId(dhan.client_id || ''); setOk(null); setEditing(true); };

  return (
    <div className="card stack">
      <div className="sec-h">
        <div>
          <h2>Client ID</h2>
          <p className="muted small">Set once. It identifies your Dhan account and rarely changes.</p>
        </div>
        {!editing && <EditButton onClick={startEdit} label="Edit Client ID" />}
      </div>

      {!editing ? (
        <>
          <div className="kv-row">
            <span className="muted">Client ID</span>
            {dhan.client_id ? <code className="temp">{dhan.client_id}</code> : <Badge value="inactive" label="Not set" />}
          </div>
          {dhan.client_id_updated_at && (
            <div className="kv-row"><span className="muted">Updated</span><span>{fmtDate(dhan.client_id_updated_at)}{dhan.client_id_updated_by ? ` · by ${dhan.client_id_updated_by}` : ''}</span></div>
          )}
          {ok && <Alert type="ok">{ok}</Alert>}
        </>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Client ID" id="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="e.g. 1100123456" error={s.errors.client_id || s.error} autoComplete="off" autoFocus />
          <div className="sec-f">
            <button type="button" className="btn btn-line" onClick={() => setEditing(false)} disabled={s.busy}>Cancel</button>
            <Button busy={s.busy} disabled={!changed}>Save Client ID</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function TokenSection({ dhan, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState('');
  const [ok, setOk] = useState(null);
  const s = useSubmit();

  const submit = (e) => {
    e.preventDefault();
    s.run(async () => {
      const r = await saveDhanToken(token.trim());
      onSaved(r.dhan);
      setToken('');
      setOk(r.message);
      setEditing(false);
    });
  };

  const startEdit = () => { setToken(''); setOk(null); setEditing(true); };

  return (
    <div className="card stack">
      <div className="sec-h">
        <div>
          <h2>Access token</h2>
          <p className="muted small">Expires daily — paste a fresh token each trading day.</p>
        </div>
        {!editing && <EditButton onClick={startEdit} label="Update access token" />}
      </div>

      {!editing ? (
        <>
          <div className="kv-row">
            <span className="muted">Status</span>
            {dhan.token_set
              ? <Badge value={dhan.token_stale ? 'pending' : 'active'} label={dhan.token_stale ? 'Expired — update to resume' : `Active · ${dhan.hours_left}h left`} />
              : <Badge value="inactive" label="Not set" />}
          </div>
          {dhan.token_set && (
            <>
              <div className="kv-row"><span className="muted">Token</span><code className="temp">{dhan.token_masked}</code></div>
              <div className="kv-row"><span className="muted">Updated</span><span>{fmtDate(dhan.token_updated_at)}{dhan.token_updated_by ? ` · by ${dhan.token_updated_by}` : ''}</span></div>
              <div className="kv-row"><span className="muted">{dhan.token_stale ? 'Expired' : 'Expires'}</span><span>{fmtDate(dhan.expires_at)} · {dhan.ttl_hours}h after it was set</span></div>
            </>
          )}
          {ok && <Alert type="ok">{ok}</Alert>}
        </>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="New access token" id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste today's Dhan access token" error={s.errors.token || s.error} autoComplete="off" autoFocus />
          <div className="sec-f">
            <button type="button" className="btn btn-line" onClick={() => setEditing(false)} disabled={s.busy}>Cancel</button>
            <Button busy={s.busy} disabled={token.trim().length < 20}>Update token</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function Broker() {
  const [dhan, setDhan] = useState(null);

  useEffect(() => { getDhanStatus().then((r) => setDhan(r.dhan)).catch(() => setDhan(false)); }, []);

  if (dhan === null) return <Loading />;
  if (dhan === false) return <Alert>Could not load Dhan settings.</Alert>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-h">
        <div>
          <h1>Dhan API credentials</h1>
          <p className="muted" style={{ margin: 0 }}>Shared by all users. Live market data and orders use these.</p>
        </div>
        <Badge value={dhan.ready ? 'active' : 'pending'} label={dhan.ready ? 'Ready' : 'Incomplete'} />
      </div>

      <div className="stack">
        <ClientIdSection dhan={dhan} onSaved={setDhan} />
        <TokenSection dhan={dhan} onSaved={setDhan} />
      </div>

      <p className="hint" style={{ marginTop: 14 }}>Generate these from your Dhan account (Profile → DhanHQ Trading APIs). The Client ID stays the same; the token must be refreshed every day.</p>
    </div>
  );
}
