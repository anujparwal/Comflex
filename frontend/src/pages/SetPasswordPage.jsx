/**
 * SetPasswordPage — Post-Google-registration flow.
 * After Google OAuth login, new users must set a password and choose a username.
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authApi } from '../api/authApi';

export default function SetPasswordPage() {
  const { user, setPassword, setUsername, refreshProfile } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState('username'); // 'username' → 'password' → 'done'
  const [username, setUsernameValue] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user already has both, redirect away
  useEffect(() => {
    if (user?.username && user?.hasPassword) {
      navigate('/profile');
    }
    if (user?.username) {
      setStep('password');
    }
  }, [user, navigate]);

  // Check username availability with debounce
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await authApi.checkUsername(username);
        setUsernameAvailable(res.data.data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await setUsername(username);
      setStep('password');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set username.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await setPassword(password);
      await refreshProfile();
      navigate('/profile');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Almost There!</h1>
          <p className="text-[var(--color-text-secondary)]">
            {step === 'username' ? 'Choose your username' : 'Set a password for your account'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${step === 'username' ? 'bg-[var(--color-accent)]' : 'bg-green-500'}`} />
          <div className={`w-12 h-0.5 ${step === 'password' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'password' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
        </div>

        {error && (
          <div className="alert alert-danger mb-6">
            {error}
          </div>
        )}

        {step === 'username' ? (
          <form onSubmit={handleUsernameSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. john_doe"
                value={username}
                onChange={(e) => setUsernameValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                minLength={3}
                maxLength={30}
                required
              />
              <div className="mt-2 text-xs">
                {usernameChecking && (
                  <span className="text-[var(--color-text-muted)] animate-pulse">Checking...</span>
                )}
                {!usernameChecking && usernameAvailable === true && (
                  <span className="text-green-400">✓ Available</span>
                )}
                {!usernameChecking && usernameAvailable === false && (
                  <span className="text-red-400">✗ Already taken</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !usernameAvailable}
            >
              {loading ? 'Setting...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                className="input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Setting...' : 'Set Password & Continue'}
            </button>

            <button
              type="button"
              className="btn btn-secondary w-full text-sm"
              onClick={() => navigate('/profile')}
            >
              Skip for now
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
