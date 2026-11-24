import { ROLE_LABELS } from '../lib/format';

export function Alert({ type = 'err', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'err' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Badge({ value, label }) {
  return <span className={`badge b-${value}`}>{label ?? value.charAt(0).toUpperCase() + value.slice(1)}</span>;
}

export const RoleBadge = ({ role }) => <Badge value={role} label={ROLE_LABELS[role] ?? role} />;

export function Field({ label, id, error, hint, type = 'text', ...input }) {
  return (
    <div className="f">
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} name={id} type={type} {...input} aria-invalid={!!error} />
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="hint err-text">{error}</div>}
    </div>
  );
}

export function Button({ busy, children, className = '', ...rest }) {
  return (
    <button className={`btn ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? 'Please wait…' : children}
    </button>
  );
}

export const Loading = () => <div className="empty">Loading…</div>;

export function Icon({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

export function Pager({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="pager">
      {meta.page > 1 && <button className="btn btn-sm btn-line" onClick={() => onPage(meta.page - 1)}>← Prev</button>}
      <span className="muted">Page {meta.page} of {meta.pages}</span>
      {meta.page < meta.pages && <button className="btn btn-sm btn-line" onClick={() => onPage(meta.page + 1)}>Next →</button>}
    </div>
  );
}
