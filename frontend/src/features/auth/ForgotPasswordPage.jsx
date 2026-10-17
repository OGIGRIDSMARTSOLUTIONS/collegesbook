import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { authService } from '../../services/auth.service';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email a secure password reset link if this address has an account.">
      {sent ? (
        <p className="rounded-lg bg-brand-soft p-4 text-sm text-text">If this email is registered, a reset link will arrive shortly. Check your spam folder too.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
        </form>
      )}
      <Link to="/login" className="mt-5 inline-block text-sm font-medium text-brand">Back to sign in</Link>
    </AuthLayout>
  );
}
