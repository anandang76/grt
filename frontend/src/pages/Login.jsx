import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GoogleButton from '../components/GoogleButton';
import { Alert, Button, Field } from '../components/ui';
import { post } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import { useSubmit } from '../lib/hooks';

export default function Login() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('m') === 'otp' ? 'otp' : 'pw';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [info, setInfo] = useState(null);
  const [remember, setRemember] = useState(false);
  const s = useSubmit();

  const done = (u) => {
    setUser(u);
    nav(u.must_change_password ? '/profile' : homeFor(u), { replace: true });
  };

  const loginPassword = (e) => {
    e.preventDefault();
    s.run(async () => done((await post('/auth/login', { email, password, remember })).user));
  };

  const sendCode = (e, to = email) => {
    e?.preventDefault();
    setInfo(null);
    s.run(async () => {
      const r = await post('/auth/otp/send', { email: to, purpose: 'login' });
      setSentTo(to);
      setInfo(r.message);
    });
  };

  const verify = (e) => {
    e.preventDefault();
    s.run(async () => done((await post('/auth/otp/login', { email: sentTo, code, remember })).user));
  };

  const google = (credential) => s.run(async () => done((await post('/auth/google', { credential, mode: 'signin', remember })).user));

  const topError = s.error || s.errors.email || s.errors.code || s.errors.password;

  const rememberBox = (
    <div className="f">
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Keep me logged in for today <span className="muted small">(until midnight; skip on shared devices)</span></span>
      </label>
    </div>
  );

  return (
    <div className="card auth">
      <h1>Welcome back</h1>
      <p className="sub">Log in to your GR Trading account.</p>

      <div className="tabs">
        <Link className={mode === 'pw' ? 'on' : ''} to="/login" replace>Password</Link>
        <Link className={mode === 'otp' ? 'on' : ''} to="/login?m=otp" replace>Email OTP</Link>
      </div>

      <Alert type="ok">{!topError && info}</Alert>
      <Alert>{topError}</Alert>

      {mode === 'pw' && (
        <form onSubmit={loginPassword} noValidate>
          <Field label="Email" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Field label="Password" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {rememberBox}
          <Button className="btn-block" busy={s.busy}>Log in</Button>
        </form>
      )}

      {mode === 'otp' && !sentTo && (
        <form onSubmit={sendCode} noValidate>
          <Field label="Email" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Button className="btn-block" busy={s.busy}>Send code</Button>
        </form>
      )}

      {mode === 'otp' && sentTo && (
        <>
          <p className="small muted">Enter the 6-digit code sent to <b>{sentTo}</b>.</p>
          <form onSubmit={verify} noValidate>
            <div className="f">
              <input className="otp" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" aria-label="6-digit code"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
            {rememberBox}
            <Button className="btn-block" busy={s.busy} disabled={code.length !== 6}>Verify &amp; log in</Button>
          </form>
          <div className="links">
            <button className="linkbtn" type="button" onClick={(e) => sendCode(e, sentTo)} disabled={s.busy}>Resend code</button>
            <button className="linkbtn" type="button" onClick={() => { setSentTo(null); setCode(''); setInfo(null); }}>Use a different email</button>
          </div>
        </>
      )}

      <GoogleButton mode="signin" onCredential={google} />

      <div className="links">
        <Link to="/forgot">Forgot password?</Link>
        <span>New here? <Link to="/signup">Sign up</Link></span>
      </div>
    </div>
  );
}
