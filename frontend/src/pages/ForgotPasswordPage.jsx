/**
 * ForgotPasswordPage — Request a password reset link.
 * 
 * User enters their email → system sends a reset token (console-logged in dev).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Comflex</h1>
          <p className="text-[var(--color-text-secondary)]">Reset your password</p>
        </div>

        <div className="glass-card p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="text-xl font-bold">Check Your Email</h2>
              <p className="text-[var(--color-text-secondary)] text-sm">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <Link to="/login" className="btn btn-secondary inline-block mt-4">
                ← Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Forgot Password</h2>
              <p className="text-[var(--color-text-secondary)] text-sm mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="bg-[var(--color-danger)] bg-opacity-10 border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] rounded-xl p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? <span className="spinner" /> : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-[var(--color-accent-light)] hover:underline">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
