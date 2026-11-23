import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';

let scriptPromise;
const loadGsi = () =>
  (scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  }));

/** Google Identity Services button. Renders nothing until a client id is configured. */
export default function GoogleButton({ mode = 'signin', onCredential }) {
  const { config } = useAuth();
  const el = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const clientId = config.google_client_id;

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    loadGsi()
      .then(() => {
        if (!alive || !el.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        window.google.accounts.id.renderButton(el.current, {
          type: 'standard', shape: 'pill', size: 'large', width: 300,
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [clientId, mode]);

  if (!clientId) return null;
  return (
    <>
      <div className="or"><span>or</span></div>
      <div className="gbtn" ref={el} />
    </>
  );
}
