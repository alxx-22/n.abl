import { useEffect, useState, type FormEvent } from 'react';
import { ADMIN_API, onSignInNeeded, signedIn } from '../api.ts';
import { toast } from './Toaster.tsx';

// Shown only when the server has CONSOLE_PASSWORD set.
export function SignIn() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  useEffect(() => onSignInNeeded(() => setOpen(true)), []);
  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${ADMIN_API}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return toast('That password did not work.');
    setOpen(false);
    setPassword('');
    signedIn();
  };

  return (
    <div className="overlay">
      <form className="panel signin" onSubmit={submit}>
        <h2>Sign in</h2>
        <label htmlFor="password">Console password</label>
        <input id="password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}
