// Tiny fetch wrapper for the Laravel API (Sanctum cookie auth + CSRF).
export class ApiError extends Error {
  constructor(message, status, errors = {}, data = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

const xsrf = () => {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const csrfCookie = () => fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  if (method !== 'GET' && !xsrf()) await csrfCookie();

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = xsrf();
  if (token) headers['X-XSRF-TOKEN'] = token;

  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }

  // CSRF token expired: refresh once and retry.
  if (res.status === 419 && retry) {
    await csrfCookie();
    return api(path, { method, body, retry: false });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:expired'));
    if (res.status === 403 && data?.must_change_password) window.dispatchEvent(new Event('auth:must-change'));
    const errors = data?.errors || {};
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, errors, data);
  }
  return data;
}

export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const put = (path, body = {}) => api(path, { method: 'PUT', body });
