import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Loading, Pager } from '../../components/ui';
import { actionLabel, fmtDate, metaText } from '../../lib/format';
import { useFetch } from '../../lib/hooks';

export default function Activity() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useFetch(`/admin/audit?page=${page}`);

  return (
    <>
      <div className="page-h"><h1>Activity log</h1><span className="muted small">{data ? `${data.meta.total} events` : ''}</span></div>
      <Alert>{error}</Alert>
      <div className="card tcard">
        {loading && !data ? <Loading /> : !data?.data.length ? (
          <div className="empty">No activity yet.</div>
        ) : (
          <table className="rt">
            <thead><tr><th>Event</th><th>By</th><th>User</th><th>When</th><th>IP</th></tr></thead>
            <tbody>
              {data.data.map((a) => (
                <tr key={a.id}>
                  <td className="who"><b>{actionLabel(a.action)}</b>{a.meta && <span>{metaText(a.meta)}</span>}</td>
                  <td data-l="By">{a.actor?.name ?? '—'}</td>
                  <td data-l="User">{a.target ? <Link to={`/admin/users/${a.target.id}`}>{a.target.name}</Link> : '—'}</td>
                  <td data-l="When">{fmtDate(a.created_at)}</td>
                  <td data-l="IP">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager meta={data?.meta} onPage={setPage} />
    </>
  );
}
