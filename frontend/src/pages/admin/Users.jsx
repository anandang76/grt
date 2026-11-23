import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Loading, Pager, RoleBadge } from '../../components/ui';
import { fmtDate, ROLE_LABELS } from '../../lib/format';
import { useFetch } from '../../lib/hooks';

const STATUSES = { pending: 'Pending', active: 'Active', inactive: 'Inactive', rejected: 'Rejected' };

export default function Users() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const { data, error, loading } = useFetch(`/admin/users?${params.toString()}`);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  return (
    <>
      <div className="page-h"><h1>Users</h1><span className="muted small">{data ? `${data.meta.total} found` : ''}</span></div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or mobile" aria-label="Search" />
        <select value={params.get('status') || ''} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={params.get('role') || ''} onChange={(e) => update({ role: e.target.value })} aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn btn-line" type="submit">Search</button>
      </form>

      <Alert>{error}</Alert>
      <div className="card tcard">
        {loading && !data ? <Loading /> : !data?.data.length ? (
          <div className="empty">No users match your filters.</div>
        ) : (
          <table className="rt">
            <thead><tr><th>User</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td className="who"><b>{u.name}</b><span>{u.email}</span></td>
                  <td data-l="Mobile">{u.phone || '—'}</td>
                  <td data-l="Role"><RoleBadge role={u.role} /></td>
                  <td data-l="Status"><Badge value={u.status} /></td>
                  <td data-l="Last login">{fmtDate(u.last_login_at)}</td>
                  <td className="acts"><div className="row-actions"><Link className="btn btn-sm btn-line" to={`/admin/users/${u.id}`}>{u.can_manage ? 'Manage' : 'View'}</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager meta={data?.meta} onPage={(p) => update({ page: String(p) })} />
    </>
  );
}
