/**
 * App — Root component with React Router setup.
 * 
 * Routes:
 *   /login          → LoginPage (public)
 *   /register       → RegisterPage (public, gated by system config)
 *   /set-password   → SetPasswordPage (authenticated, post-Google flow)
 *   /setup          → SetupPage (admin only, first boot)
 *   /profile        → ProfilePage (authenticated)
 *   /admin          → AdminDashboard (Ring 0 only)
 *   /groups         → GroupsPage (authenticated)
 *   /friends        → FriendsPage (authenticated)
 *   /messages       → MessagesPage (authenticated)
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
import SetPasswordPage from './pages/SetPasswordPage';
import FriendsPage from './pages/FriendsPage';
import MessagesPage from './pages/MessagesPage';
import EventsPage from './pages/EventsPage';
import ManageEventsPage from './pages/ManageEventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import JoinGroupPage from './pages/JoinGroupPage';
import ResourcesPage from './pages/ResourcesPage';
import StorePage from './pages/StorePage';
import FloatingChatbot from './components/FloatingChatbot';
import Homepage from './pages/Homepage';

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

          {/* Post-Google registration setup */}
          <Route path="/set-password" element={
            <ProtectedRoute>
              <SetPasswordPage />
            </ProtectedRoute>
          } />

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
          <Route path="/join/:token" element={
            <ProtectedRoute>
              <JoinGroupPage />
            </ProtectedRoute>
          } />

          {/* Friends */}
          <Route path="/friends" element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          } />

          {/* Messages (DMs) */}
          <Route path="/messages" element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          } />
          <Route path="/messages/:userId" element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          } />

          {/* Events */}
          <Route path="/events" element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          } />
          <Route path="/manage-events" element={
            <ProtectedRoute>
              <ManageEventsPage />
            </ProtectedRoute>
          } />
          <Route path="/events/:id" element={
            <ProtectedRoute>
              <EventDetailsPage />
            </ProtectedRoute>
          } />

          {/* Resources */}
          <Route path="/resources" element={
            <ProtectedRoute>
              <ResourcesPage />
            </ProtectedRoute>
          } />

          {/* Store */}
          <Route path="/store" element={
            <ProtectedRoute>
              <StorePage />
            </ProtectedRoute>
          } />

          {/* Default redirect replacing old redirect with Homepage */}
          <Route path="/" element={<Homepage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <FloatingChatbot />
      </AuthProvider>
    </BrowserRouter>
  );
}
