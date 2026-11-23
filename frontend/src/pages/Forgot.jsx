import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Field } from '../components/ui';
import { post } from '../lib/api';
import { useSubmit } from '../lib/hooks';

export default function Forgot() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [info, setInfo] = useState(null);
  const [f, setF] = useState({ code: '', password: '', password_confirmation: '' });
  const s = useSubmit();

  const send = (e, to = email) => {
    e?.preventDefault();
    setInfo(null);
    s.run(async () => {
      const r = await post('/auth/otp/send', { email: to, purpose: 'reset' });
      setSentTo(to);
      setInfo(r.message);
    });
  };

  const reset = (e) => {
    e.preventDefault();
    s.run(async () => {
      const r = await post('/auth/password/reset', { email: sentTo, ...f });
      nav('/login', { replace: true, state: { flash: { type: 'ok', msg: r.message } } });
    });
  };

  return (
    <div className="card auth">
      <h1>Reset password</h1>
      {!sentTo ? (
        <>
          <p className="sub">Enter your email and we will send you a 6-digit code.</p>
          <Alert>{s.error || s.errors.email}</Alert>
          <form onSubmit={send} noValidate>
            <Field label="Email" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <Button className="btn-block" busy={s.busy}>Send code</Button>
          </form>
        </>
      ) : (
        <>
          <p className="sub">Enter the code sent to <b>{sentTo}</b> and choose a new password.</p>
          <Alert type="ok">{!s.error && !s.errors.code && info}</Alert>
          <Alert>{s.error || s.errors.code || s.errors.email}</Alert>
          <form onSubmit={reset} noValidate>
            <div className="f">
              <label htmlFor="code">6-digit code</label>
              <input id="code" className="otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={f.code}
                onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '') })} autoFocus />
            </div>
            <Field label="New password" id="password" type="password" autoComplete="new-password" value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })} error={s.errors.password} hint="At least 8 characters, with letters and numbers." />
            <Field label="Confirm new password" id="password_confirmation" type="password" autoComplete="new-password" value={f.password_confirmation}
              onChange={(e) => setF({ ...f, password_confirmation: e.target.value })} />
            <Button className="btn-block" busy={s.busy}>Update password</Button>
          </form>
          <div className="links">
            <button className="linkbtn" type="button" onClick={(e) => send(e, sentTo)} disabled={s.busy}>Resend code</button>
            <button className="linkbtn" type="button" onClick={() => { setSentTo(null); setInfo(null); }}>Use a different email</button>
          </div>
        </>
      )}
      <div className="links"><Link to="/login">← Back to log in</Link></div>
    </div>
  );
}
