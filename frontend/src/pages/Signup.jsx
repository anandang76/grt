import { useState } from 'react';
import { Link } from 'react-router-dom';
import GoogleButton from '../components/GoogleButton';
import { Alert, Button, Field } from '../components/ui';
import { post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSubmit } from '../lib/hooks';

export default function Signup() {
  const { config } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', password_confirmation: '', terms: false });
  const [done, setDone] = useState(false);
  const s = useSubmit();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = (e) => {
    e.preventDefault();
    s.run(async () => {
      await post('/auth/signup', f);
      setDone(true);
    });
  };

  const google = (credential) => {
    if (!f.phone.trim()) return s.setError('Enter your mobile number first, then continue with Google.');
    if (!f.terms) return s.setError('Please accept the Terms & Conditions first.');
    s.run(async () => {
      await post('/auth/google', { credential, mode: 'signup', phone: f.phone, terms: true });
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="card auth center">
        <div className="big-ico">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1>Signup received</h1>
        <p className="sub">Your account is <b>awaiting admin approval</b>. We will email you as soon as it is approved, and then you can log in.</p>
        <Link className="btn btn-line" to="/">Back to home</Link>
      </div>
    );
  }

  const err = s.errors;
  return (
    <div className="card auth">
      <h1>Create your account</h1>
      <p className="sub">An admin approves new accounts before first login.</p>
      <Alert>{s.error}</Alert>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" id="name" autoComplete="name" value={f.name} onChange={set('name')} error={err.name} autoFocus />
        <Field label="Email" id="email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={err.email} />
        <Field label="Mobile number" id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile" value={f.phone} onChange={set('phone')} error={err.phone} />
        <Field label="Password" id="password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={err.password} hint="At least 8 characters, with letters and numbers." />
        <Field label="Confirm password" id="password_confirmation" type="password" autoComplete="new-password" value={f.password_confirmation} onChange={set('password_confirmation')} />
        <div className="f">
          <label className="check">
            <input type="checkbox" checked={f.terms} onChange={set('terms')} />
            <span>I accept the <Link to="/terms" target="_blank">Terms &amp; Conditions</Link> and Privacy Policy.</span>
          </label>
          {err.terms && <div className="hint err-text">{err.terms}</div>}
        </div>
        <Button className="btn-block" busy={s.busy}>Sign up</Button>
      </form>

      {config.google_client_id && (
        <>
          <GoogleButton mode="signup" onCredential={google} />
          <p className="hint center">For Google signup, enter your mobile number and accept the terms above first.</p>
        </>
      )}

      <div className="links"><span>Already have an account? <Link to="/login">Log in</Link></span></div>
    </div>
  );
}
