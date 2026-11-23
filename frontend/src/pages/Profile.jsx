import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Field } from '../components/ui';
import { post } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import { useSubmit } from '../lib/hooks';

export default function Profile() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const needsCurrent = user.has_password && !user.must_change_password;
  const [f, setF] = useState({ current_password: '', password: '', password_confirmation: '' });
  const s = useSubmit();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    s.run(async () => {
      const r = await post('/auth/password', f);
      setUser(r.user);
      nav(homeFor(r.user), { replace: true, state: { flash: { type: 'ok', msg: r.message } } });
    });
  };

  return (
    <div className="card stack">
      <div>
        <h1>{user.must_change_password ? 'Set a new password' : 'Profile'}</h1>
        <p className="sub" style={{ margin: 0 }}>{user.name} · {user.email}</p>
      </div>
      <Alert>{s.error}</Alert>
      <form onSubmit={submit} noValidate>
        <h2>{user.has_password ? 'Change password' : 'Set a password'}</h2>
        {!user.has_password && <p className="small muted">You signed up with Google or OTP. Setting a password lets you log in with email and password too.</p>}
        {needsCurrent && (
          <Field label="Current password" id="current_password" type="password" autoComplete="current-password" value={f.current_password} onChange={set('current_password')} error={s.errors.current_password} />
        )}
        <Field label="New password" id="password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={s.errors.password} hint="At least 8 characters, with letters and numbers." />
        <Field label="Confirm new password" id="password_confirmation" type="password" autoComplete="new-password" value={f.password_confirmation} onChange={set('password_confirmation')} />
        <Button className="btn-block" busy={s.busy}>Save password</Button>
      </form>
    </div>
  );
}
