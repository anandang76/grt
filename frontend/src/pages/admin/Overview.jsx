import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Loading, RoleBadge } from '../../components/ui';
import { post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { useFetch } from '../../lib/hooks';

export default function Overview() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/admin/stats');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  const act = async (u, action) => {
    if (action === 'reject' && !confirm(`Reject ${u.name}'s signup?`)) return;
    setBusy(u.id);
    try {
      const r = await post(`/admin/users/${u.id}/action`, { action });
      setMsg({ type: 'ok', text: r.message });
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const c = data?.counts;
  return (
    <>
      <div className="page-h">
        <div>
          <h1>Admin</h1>
          <p className="muted" style={{ margin: 0 }}>Hello, {user.name} · <RoleBadge role={user.role} /></p>
        </div>
      </div>
      <Alert type={msg?.type}>{msg?.text}</Alert>
      <Alert>{error}</Alert>

      <div className="stats">
        <Link className="card stat" to="/admin/users"><b>{c?.total ?? '–'}</b><span>Total users</span></Link>
        <Link className="card stat" to="/admin/users?status=pending"><b className="c-warn">{c?.pending ?? '–'}</b><span>Pending approval</span></Link>
        <Link className="card stat" to="/admin/users?status=active"><b className="c-ok">{c?.active ?? '–'}</b><span>Active</span></Link>
        <Link className="card stat" to="/admin/users?status=inactive"><b className="c-err">{c?.inactive ?? '–'}</b><span>Inactive / rejected</span></Link>
      </div>

      <div className="card tcard">
        <div className="tcard-h"><h2>Pending approvals</h2><span className="badge b-pending">{data?.pending.length ?? 0}</span></div>
        {loading && !data ? <Loading /> : !data?.pending.length ? (
          <div className="empty">No signups waiting for approval.</div>
        ) : (
          <table className="rt">
            <thead><tr><th>User</th><th>Mobile</th><th>Signed up</th><th /></tr></thead>
            <tbody>
              {data.pending.map((u) => (
                <tr key={u.id}>
                  <td className="who"><Link to={`/admin/users/${u.id}`}><b>{u.name}</b></Link><span>{u.email}{u.has_google ? ' · Google' : ''}</span></td>
                  <td data-l="Mobile">{u.phone || '—'}</td>
                  <td data-l="Signed up">{fmtDate(u.created_at)}</td>
                  <td className="acts">
                    <div className="row-actions">
                      <button className="btn btn-sm btn-ok" disabled={busy === u.id} onClick={() => act(u, 'approve')}>Approve</button>
                      <button className="btn btn-sm btn-line" disabled={busy === u.id} onClick={() => act(u, 'reject')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
