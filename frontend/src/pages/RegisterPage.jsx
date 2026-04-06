/**
 * RegisterPage — New user registration form.
 * 
 * Shows "System not configured" message if institution setup is pending.
 * On success, auto-logs in and redirects to profile.
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register, isAuthenticated, systemStatus, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', displayName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  // Registration gate: system must be configured
  if (!authLoading && systemStatus && !systemStatus.isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md fade-in">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-xl font-bold mb-2">Registration Not Available</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            The platform hasn&apos;t been configured yet. Please contact your administrator.
          </p>
          <Link to="/login" className="text-[var(--color-accent-light)] hover:underline text-sm">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(form.email, form.password, form.displayName);
      navigate('/profile');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Comflex</h1>
          <p className="text-[var(--color-text-secondary)]">Create your account</p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-xl font-bold mb-6">Register</h2>

          {error && (
            <div className="bg-[var(--color-danger)] bg-opacity-10 border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] rounded-xl p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Display Name
              </label>
              <input id="reg-name" name="displayName" type="text" value={form.displayName} onChange={handleChange}
                placeholder="John Doe" required minLength={2} maxLength={50} autoFocus />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Institutional Email
              </label>
              <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="28bcs045@institution.edu" required />
            </div>

            <div>
              <label htmlFor="reg-pwd" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Password
              </label>
              <input id="reg-pwd" name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="Min 8 characters" required minLength={8} />
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Confirm Password
              </label>
              <input id="reg-confirm" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
                placeholder="Re-enter password" required />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-accent-light)] hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
