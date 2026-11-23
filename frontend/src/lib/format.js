export const ROLE_LABELS = { user: 'User', admin: 'Admin', superadmin: 'Super Admin' };

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const num = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPrice = (n) => (n == null ? '—' : num.format(n));

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

export const actionLabel = (a) => a.replaceAll('_', ' ');

export const metaText = (m) => (m ? Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(', ') : '');
