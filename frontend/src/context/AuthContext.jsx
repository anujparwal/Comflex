/**
 * Auth Context — Global authentication state provider.
 * 
 * Provides: user, token, isAuthenticated, isAdmin, login, logout,
 * register, googleLogin, setPassword, setUsername.
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { adminApi } from '../api/adminApi';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState(null);

  // Check if user is currently authenticated (on mount)
  useEffect(() => {
    const init = async () => {
      try {
        // Check system status first
        const statusRes = await adminApi.getSystemStatus();
        setSystemStatus(statusRes.data.data);

        // Check for existing token
        const token = localStorage.getItem('accessToken');
        if (token) {
          const profileRes = await userApi.getProfile();
          setUser(profileRes.data.data);
        }
      } catch {
        // Token invalid or expired — clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const { accessToken, refreshToken, user: userData } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const res = await authApi.register(email, password, displayName);
    const { accessToken, refreshToken, user: userData } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return userData;
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const res = await authApi.googleLogin(idToken);
    const { accessToken, refreshToken, user: userData, needsPassword, needsUsername } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return { user: userData, needsPassword, needsUsername };
  }, []);

  const setPasswordFn = useCallback(async (newPassword) => {
    const res = await authApi.setPassword(newPassword);
    // Refresh the user profile to get updated hasPassword
    const profileRes = await userApi.getProfile();
    setUser(profileRes.data.data);
    return res.data.data;
  }, []);

  const setUsernameFn = useCallback(async (username) => {
    const res = await authApi.setUsername(username);
    // Refresh profile
    const profileRes = await userApi.getProfile();
    setUser(profileRes.data.data);
    return res.data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await userApi.getProfile();
    setUser(res.data.data);
  }, []);

  const value = {
    user,
    loading,
    systemStatus,
    isAuthenticated: !!user,
    isAdmin: user?.globalRing === 0,
    isManager: user?.globalRing <= 1,
    login,
    register,
    googleLogin,
    setPassword: setPasswordFn,
    setUsername: setUsernameFn,
    logout,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
