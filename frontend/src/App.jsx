/**
 * App — Root component with React Router setup.
 * 
 * Routes:
 *   /login          → LoginPage (public)
 *   /register       → RegisterPage (public, gated by system config)
 *   /setup          → SetupPage (admin only, first boot)
 *   /profile        → ProfilePage (authenticated)
 *   /admin          → AdminDashboard (Ring 0 only)
 *   /               → Redirects to /profile or /login
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import SetupPage from './pages/SetupPage';
import AdminDashboard from './pages/AdminDashboard';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import GroupsPage from './pages/GroupsPage';
import ChatPage from './pages/ChatPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin setup (first boot) */}
          <Route path="/setup" element={
            <ProtectedRoute maxRing={0}>
              <SetupPage />
            </ProtectedRoute>
          } />

          {/* Authenticated routes */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />

          {/* Admin-only dashboard */}
          <Route path="/admin" element={
            <ProtectedRoute maxRing={0}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Groups & Chat */}
          <Route path="/groups" element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          } />
          <Route path="/groups/:id" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
