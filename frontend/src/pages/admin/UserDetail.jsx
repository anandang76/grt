import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Loading, RoleBadge } from '../../components/ui';
import { post } from '../../lib/api';
import { isSuper, useAuth } from '../../lib/auth';
import { actionLabel, fmtDate, metaText, ROLE_LABELS } from '../../lib/format';
import { useFetch } from '../../lib/hooks';

const CONFIRM = {
  reject: 'Reject this signup?',
  deactivate: 'Deactivate this user? They will be logged out immediately.',
  reset_password: 'Generate a temporary password and email it to this user?',
};

export default function UserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useFetch(`/admin/users/${id}`);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('');

  if (loading && !data) return <Loading />;
  if (!data) return <Alert>{error || 'User not found.'}</Alert>;

  const { user: t, can_manage: canManage, activity } = data;

  const act = async (action, extra = {}) => {
    if (CONFIRM[action] && !confirm(CONFIRM[action])) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post(`/admin/users/${t.id}/action`, { action, ...extra });
      setMsg({ type: 'ok', text: r.message, temp: r.temp_password });
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const methods = [t.has_password && 'Password', 'Email OTP', t.has_google && 'Google'].filter(Boolean).join(', ');

  return (
    <>
      <div className="page-h">
        <div>
          <Link className="small" to="/admin/users">← All users</Link>
          <h1 style={{ marginTop: 4 }}>{t.name}</h1>
        </div>
        <div><RoleBadge role={t.role} /> <Badge value={t.status} /></div>
      </div>

      {msg && (
        <Alert type={msg.type}>
          {msg.text}
          {msg.temp && <> Temporary password: <code className="temp">{msg.temp}</code> (shown once)</>}
        </Alert>
      )}

      <div className="two">
        <div className="card">
          <h2>Details</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{t.email} {t.email_verified_at && <span className="badge b-active">verified</span>}</dd>
            <dt>Mobile</dt><dd>{t.phone || '—'}</dd>
            <dt>Login methods</dt><dd>{methods}</dd>
            <dt>Signed up</dt><dd>{fmtDate(t.created_at)}</dd>
            <dt>Terms accepted</dt><dd>{fmtDate(t.terms_accepted_at)}</dd>
            <dt>Approved</dt><dd>{t.approved_at ? `${fmtDate(t.approved_at)}${t.approved_by_name ? ` by ${t.approved_by_name}` : ''}` : '—'}</dd>
            <dt>Last login</dt><dd>{fmtDate(t.last_login_at)}</dd>
          </dl>
        </div>

        <div className="card actions-list">
          <h2>Actions</h2>
          {!canManage ? (
            <p className="muted small" style={{ margin: 0 }}>
              {t.id === me.id ? 'You cannot change your own account here. Use Profile instead.' : 'You do not have permission to manage this account.'}
            </p>
          ) : (
            <>
              {t.status === 'pending' && (
                <div className="act-row">
                  <span className="grow">Approve this signup so the user can log in.</span>
                  <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => act('approve')}>Approve</button>
                  <button className="btn btn-sm btn-line" disabled={busy} onClick={() => act('reject')}>Reject</button>
                </div>
              )}
              {t.status === 'active' && (
                <div className="act-row">
                  <span className="grow">Block this user from logging in.</span>
                  <button className="btn btn-sm btn-err" disabled={busy} onClick={() => act('deactivate')}>Deactivate</button>
                </div>
              )}
              {(t.status === 'inactive' || t.status === 'rejected') && (
                <div className="act-row">
                  <span className="grow">Allow this user to log in again.</span>
                  <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => act('activate')}>Activate</button>
                </div>
              )}
              {isSuper(me) && (
                <>
                  <div className="act-row">
                    <span className="grow">Reset password: email a temporary password. The user must change it at next login.</span>
                    <button className="btn btn-sm btn-line" disabled={busy} onClick={() => act('reset_password')}>Reset password</button>
                  </div>
                  <div className="act-row">
                    <label className="grow" htmlFor="role" style={{ margin: 0 }}>Role</label>
                    <select id="role" className="sel-sm" value={role || t.role} onChange={(e) => setRole(e.target.value)}>
                      {['user', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button className="btn btn-sm btn-line" disabled={busy || !role || role === t.role} onClick={() => act('set_role', { role })}>Save role</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent activity</h2>
        {!activity.length ? (
          <p className="muted small" style={{ margin: 0 }}>No activity yet.</p>
        ) : (
          <ul className="log">
            {activity.map((a) => (
              <li key={a.id}>
                <b>{actionLabel(a.action)}</b>
                {a.actor && a.actor.id !== t.id && ` by ${a.actor.name}`}
                {a.meta && <span className="muted"> · {metaText(a.meta)}</span>}
                <div className="muted">{fmtDate(a.created_at)} · {a.ip}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
