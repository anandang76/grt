import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Form submit state: busy flag, top-level error, per-field errors. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      return await fn();
    } catch (e) {
      const fields = e.errors || {};
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      // Field errors render next to their inputs; anything else shows on top.
      if (!Object.keys(fields).length) setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, errors, run, setError };
}

/** GET a resource; re-fetches when `path` changes. */
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [path, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}
