import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { authService } from '../../services/auth.service';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword({ token, password });
      setComplete(true);
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Password reset links are valid for 15 minutes and can be used only once.">
      {complete ? <p className="rounded-lg bg-brand-soft p-4 text-sm">Password changed. You can now sign in.</p> : !token ? (
        <p className="text-sm text-danger">Reset link is missing. Request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="New password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating…' : 'Reset password'}</Button>
        </form>
      )}
      <Link to={complete ? '/login' : '/forgot-password'} className="mt-5 inline-block text-sm font-medium text-brand">{complete ? 'Sign in' : 'Request a new link'}</Link>
    </AuthLayout>
  );
}
