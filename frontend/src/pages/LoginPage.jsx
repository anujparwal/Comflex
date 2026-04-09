/**
 * LoginPage — Email/password + Google OAuth login form.
 * 
 * States: form → loading → success redirect / error message.
 * Redirects to /setup if system is not configured.
 */

import { useState, useContext } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const { login, googleLogin, isAuthenticated, systemStatus, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/profile');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Comflex</h1>
          <p className="text-[var(--color-text-secondary)]">
            {systemStatus?.institutionName || 'College Community Platform'}
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-bold mb-6">Welcome back</h2>

          {error && (
            <div className="alert alert-danger mb-4">
              {error}
            </div>
          )}

          {/* Google Login */}
          {GOOGLE_CLIENT_ID && (
            <div className="mb-6">
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google login failed.')}
                    useOneTap={false}
                    text="signin_with"
                    shape="pill"
                    size="large"
                    width={300}
                    theme="filled_blue"
                  />
                </div>
              </GoogleOAuthProvider>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">or sign in with email</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2"
            >
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
            <Link to="/forgot-password" className="text-[var(--color-accent-light)] hover:underline">
              Forgot your password?
            </Link>
          </p>

          <p className="text-center text-sm text-[var(--color-text-muted)] mt-2">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-[var(--color-accent-light)] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
