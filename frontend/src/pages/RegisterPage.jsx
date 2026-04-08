/**
 * RegisterPage — Google-only registration flow.
 * Users click "Continue with Google" using their college email.
 * After successful Google auth, they're redirected to set password + username.
 */

import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function RegisterPage() {
  const { googleLogin, systemStatus } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Registration failed. Make sure you use your college email.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Gated: registration requires the platform to be configured
  if (systemStatus && !systemStatus.isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Not Available Yet</h2>
          <p className="text-[var(--color-text-secondary)]">
            The platform hasn't been configured by an admin yet. Registration will open once setup is complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Join Comflex</h1>
          <p className="text-[var(--color-text-secondary)]">
            Sign up with your college Google account
          </p>
        </div>

        {error && (
          <div className="alert alert-danger mb-6">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-6">
          {GOOGLE_CLIENT_ID ? (
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google login failed. Please try again.')}
                useOneTap={false}
                text="signup_with"
                shape="pill"
                size="large"
                width={300}
                theme="filled_blue"
              />
            </GoogleOAuthProvider>
          ) : (
            <div className="alert alert-warning text-center">
              Google OAuth is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend <code>.env</code>.
            </div>
          )}

          {loading && (
            <div className="text-[var(--color-text-secondary)] text-sm animate-pulse">
              Setting up your account...
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-accent-light)] hover:underline">
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}
