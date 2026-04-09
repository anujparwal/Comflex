/**
 * Layout — Main app layout with sidebar and top bar.
 * Wraps all authenticated pages. Shows unread badges on Groups nav.
 * Refreshes unread counts on socket events and route changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { groupApi } from '../api/groupApi';
import { dmApi } from '../api/dmApi';

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
  const { connected, onEvent } = useSocket();
  const [totalUnread, setTotalUnread] = useState({ groups: 0, dms: 0 });
  const fetchTimeoutRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Debounced fetch to avoid rapid re-fetching
  const fetchUnread = useCallback(async () => {
    try {
      const [groupRes, dmRes] = await Promise.all([
        groupApi.listGroups().catch(() => ({ data: { data: [] } })),
        dmApi.listConversations().catch(() => ({ data: { data: [] } }))
      ]);
      const groups = groupRes.data?.data || [];
      const dms = dmRes.data?.data || [];
      
      const groupUnread = groups.reduce((sum, g) => sum + (g.unreadCount || 0), 0);
      const dmUnread = dms.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setTotalUnread({ groups: groupUnread, dms: dmUnread });
    } catch {}
  }, []);

  const debouncedFetchUnread = useCallback(() => {
    clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(fetchUnread, 300);
  }, [fetchUnread]);

  // Fetch on mount + polling interval
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(fetchTimeoutRef.current);
    };
  }, [fetchUnread]);

  // Re-fetch when navigating (e.g. back from chat page after reading messages)
  useEffect(() => {
    debouncedFetchUnread();
  }, [location.pathname, debouncedFetchUnread]);

  // Listen to socket events that affect unread counts
  useEffect(() => {
    if (!connected || !onEvent) return;
    const cleanups = [
      onEvent('message:new', debouncedFetchUnread),
      onEvent('message:readUpdate', debouncedFetchUnread),
      onEvent('message:delete', debouncedFetchUnread),
      onEvent('dm:new', debouncedFetchUnread),
      onEvent('dm:readUpdate', debouncedFetchUnread),
    ];
    return () => cleanups.forEach(fn => fn?.());
  }, [connected, onEvent, debouncedFetchUnread]);

  const ringInfo = RING_LABELS[user?.globalRing] || RING_LABELS[3];

  const navItems = [
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/groups', label: 'Groups', icon: '💬', badge: totalUnread.groups },
    { path: '/friends', label: 'Friends', icon: '👥' },
    { path: '/messages', label: 'Messages', icon: '✉️', badge: totalUnread.dms },
    { path: '/resources', label: 'Resources', icon: '📚' },
    { path: '/events', label: 'Events', icon: '📅' },
    { path: '/store', label: 'Store', icon: '🛒' },
    ...(user?.globalRing <= 1 || user?.canCreateEvents ? [{ path: '/manage-events', label: 'Manage Events', icon: '📝' }] : []),
    ...(isAdmin ? [{ path: '/admin', label: 'Admin Dashboard', icon: '⚙️' }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 glass-panel flex flex-col z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
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
                location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                  ? 'bg-white/10 border-t border-t-white/30 shadow-[0_4px_20px_rgba(139,92,246,0.15)] text-white backdrop-blur-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text-primary)] border-t border-transparent'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="bg-[var(--color-danger)] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold animate-pulse">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover avatar-glow" />
            ) : (
              <div className="w-10 h-10 rounded-full avatar-gradient flex items-center justify-center text-white font-bold text-sm avatar-glow">
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
