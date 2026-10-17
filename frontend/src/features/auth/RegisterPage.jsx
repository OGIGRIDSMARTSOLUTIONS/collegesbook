import { useEffect, useState } from 'react';
import { authService } from '../../services/auth.service';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';

const initialForm = {
  matriculationNumber: '',
  departmentId: '',
  phoneNumber: '',
  email: '',
  password: '',
};

export default function RegisterPage() {
  const { register, isRegistering } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [departmentError, setDepartmentError] = useState('');
  const [departmentLookupKey, setDepartmentLookupKey] = useState(0);

  useEffect(() => {
    const matric = form.matriculationNumber.trim();
    if (matric.length < 3) {
      setDepartments([]);
      setForm((previous) => ({ ...previous, departmentId: '' }));
      setDepartmentError('');
      setLoadingDepartments(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingDepartments(true);
      setDepartmentError('');
      try {
        const result = await authService.registrationDepartments({ matriculationNumber: matric });
        if (!cancelled) {
          const items = Array.isArray(result) ? result : [];
          setDepartments(items);
          setForm((previous) => ({ ...previous, departmentId: items.some((d) => d.id === previous.departmentId) ? previous.departmentId : '' }));
          if (!items.length) setDepartmentError('No departments were returned for this student record. You can verify with your registered phone number instead.');
        }
      } catch (err) {
        if (!cancelled) {
          setDepartments([]);
          const status = err?.status;
          setDepartmentError(
            status === 404
              ? 'No unregistered student record matches this matriculation number. Check the number or use the phone number on your school record.'
              : status === 429
                ? 'Too many requests. Wait a moment and try again.'
                : status === 400
                  ? (err?.message || 'Check the matriculation number and try again.')
                  : status === undefined
                    ? 'Cannot reach the CollegeBook backend. Check that the backend is running and VITE_API_URL is correct.'
                    : (err?.message || 'Departments could not be loaded. Please try again.')
          );
        }
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.matriculationNumber, departmentLookupKey]);

  function update(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.departmentId && !form.phoneNumber.trim()) {
      setError('Enter either your department or phone number for student verification.');
      return;
    }

    try {
      await register({
        matriculationNumber: form.matriculationNumber.trim(),
        departmentId: form.departmentId || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to create your account');
    }
  }

  if (success) {
    return (
      <AuthLayout title="Account created" subtitle="Your student identity has been verified.">
        <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-6 text-text">
          Your CollegeBook account is linked to the institutional student record supplied by your school.
          You can now sign in and continue to your institution, department, academic set and YearBook.
        </div>
        <Button className="mt-6 w-full" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Verify your student identity and join your institution on CollegeBook.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4 text-sm text-text-secondary">
          <p className="font-semibold text-text">Student verification</p>
          <p className="mt-1 leading-6">
            Your matriculation number is required. Enter either your department, phone number, or both.
            Your institution already has the academic record — CollegeBook will place your account in the correct department, set and YearBook automatically.
          </p>
        </div>

        <TextField
          label="Matriculation number"
          required
          placeholder="e.g. CSC/2022/045"
          autoComplete="off"
          value={form.matriculationNumber}
          onChange={update('matriculationNumber')}
        />

        <label className="block text-sm font-medium text-text">
          Department
          <select value={form.departmentId} onChange={update('departmentId')}
            disabled={loadingDepartments || departments.length === 0}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-text disabled:opacity-60">
            <option value="">{loadingDepartments ? 'Loading departments…' : departments.length ? 'Select your department' : 'No departments available — use phone verification'}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}{department.facultyName ? ` — ${department.facultyName}` : ''}
              </option>
            ))}
          </select>
          {departmentError && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-danger" role="alert">
              <span>{departmentError}</span>
              <button type="button" onClick={() => setDepartmentLookupKey((value) => value + 1)}
                className="rounded border border-current px-2 py-1 font-semibold hover:opacity-80">
                Retry
              </button>
            </div>
          )}
        </label>

        <TextField
          label="Phone number"
          type="tel"
          placeholder="e.g. 08012345678"
          autoComplete="tel"
          value={form.phoneNumber}
          onChange={update('phoneNumber')}
        />

        <p className="-mt-1 text-xs text-text-secondary">At least one of Department or Phone number is required.</p>

        <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
        />

        {error && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        <Button type="submit" className="w-full" disabled={isRegistering}>
          {isRegistering ? 'Verifying student record…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
