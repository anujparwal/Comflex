/**
 * ResetPasswordPage — Set a new password using the reset token from the URL.
 *
 * Reads `token` from query params. On submit: calls reset API → redirect to login.
 */

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Reset token is missing. Please use the link from your email.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, form.newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password. The token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Comflex</h1>
          <p className="text-[var(--color-text-secondary)]">Set a new password</p>
        </div>

        <div className="glass-card p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-bold">Password Reset!</h2>
              <p className="text-[var(--color-text-secondary)] text-sm">
                Your password has been updated. Redirecting to login...
              </p>
              <Link to="/login" className="btn btn-primary inline-block mt-4">
                Go to Login →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-6">Reset Password</h2>

              {!token && (
                <div className="bg-[var(--color-warning)] bg-opacity-10 border border-[var(--color-warning)] border-opacity-30 text-[var(--color-warning)] rounded-xl p-3 mb-4 text-sm">
                  ⚠️ No reset token found. Please use the link from your email.
                </div>
              )}

              {error && (
                <div className="bg-[var(--color-danger)] bg-opacity-10 border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] rounded-xl p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reset-pwd" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                    New Password
                  </label>
                  <input
                    id="reset-pwd"
                    name="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="reset-confirm" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading || !token} className="btn btn-primary w-full">
                  {loading ? <span className="spinner" /> : 'Reset Password'}
                </button>
              </form>

              <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
                <Link to="/login" className="text-[var(--color-accent-light)] hover:underline">
                  ← Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
