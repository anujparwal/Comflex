/**
 * Layout — Main app layout with sidebar and top bar.
 * Wraps all authenticated pages.
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RING_LABELS = {
  0: { label: 'Admin', color: 'ring-badge-0' },
  1: { label: 'Manager', color: 'ring-badge-1' },
  2: { label: 'Elevated', color: 'ring-badge-2' },
  3: { label: 'Member', color: 'ring-badge-3' },
};

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ringInfo = RING_LABELS[user?.globalRing] || RING_LABELS[3];

  const navItems = [
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/groups', label: 'Groups', icon: '💬' },
    { path: '/friends', label: 'Friends', icon: '👥' },
    { path: '/messages', label: 'Messages', icon: '✉️' },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin Dashboard', icon: '⚙️' }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[var(--color-border)]">
          <h1 className="text-2xl font-bold gradient-text">Comflex</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">College Community Platform</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? 'chip-accent'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">
                {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.displayName}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs text-white ${ringInfo.color}`}>
                Ring {user?.globalRing} · {ringInfo.label}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary w-full text-xs">
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
