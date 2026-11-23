import { Link } from 'react-router-dom';
import { Alert, Loading, RoleBadge } from '../../components/ui';
import { ROLE_LABELS } from '../../lib/format';
import { useFetch } from '../../lib/hooks';

const ORDER = ['superadmin', 'admin', 'user'];

export default function Roles() {
  const { data, error, loading } = useFetch('/admin/roles');
  if (loading && !data) return <Loading />;
  if (!data) return <Alert>{error}</Alert>;

  return (
    <>
      <div className="page-h"><h1>Roles</h1></div>
      <div className="card tcard">
        <table className="rt">
          <thead><tr><th>Role</th><th>Description</th><th>Users</th><th>Active</th><th /></tr></thead>
          <tbody>
            {data.roles.map((r) => (
              <tr key={r.slug}>
                <td className="who"><RoleBadge role={r.slug} /></td>
                <td data-l="Description">{r.description}</td>
                <td data-l="Users">{r.total}</td>
                <td data-l="Active">{r.active}</td>
                <td className="acts"><div className="row-actions"><Link className="btn btn-sm btn-line" to={`/admin/users?role=${r.slug}`}>View users</Link></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card tcard" style={{ marginTop: 16 }}>
        <div className="tcard-h"><h2>Permissions</h2></div>
        <table className="rt">
          <thead><tr><th>Permission</th>{ORDER.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody>
            {Object.entries(data.permissions).map(([p, who]) => (
              <tr key={p}>
                <td className="who">{p}</td>
                {ORDER.map((r) => (
                  <td key={r} data-l={ROLE_LABELS[r]}>{who.includes(r) ? <span className="c-ok">✓</span> : <span className="muted">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Promote a user to Admin from their page under Users. Super Admins are created on the server with <code>php artisan grt:superadmin</code>.</p>
    </>
  );
}
