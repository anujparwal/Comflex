/**
 * ForgotPasswordPage — Request a password reset link.
 * 
 * User enters their email → system sends a reset token (console-logged in dev).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuth } from '../hooks/useAuth';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (result.needsPassword || result.needsUsername) {
        navigate('/set-password');
      } else {
        navigate('/profile');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

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
                <div className="alert alert-danger mb-4">
                  {error}
                </div>
              )}

              {GOOGLE_CLIENT_ID && (
                <div className="mb-6">
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Google login failed.')}
                        useOneTap={false}
                        text="continue_with"
                        shape="pill"
                        size="large"
                        width={300}
                        theme="filled_blue"
                      />
                    </div>
                  </GoogleOAuthProvider>

                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-xs text-[var(--color-text-muted)] uppercase">or reset with email</span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                  </div>
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
