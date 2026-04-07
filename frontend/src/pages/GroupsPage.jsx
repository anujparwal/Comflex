/**
 * GroupsPage — Lists all groups the user belongs to.
 * Admin (Ring 0) sees ALL groups on the platform.
 *
 * Clicking a group navigates to the ChatPage for that group.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { groupApi } from '../api/groupApi';
import { adminApi } from '../api/adminApi';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';

const TYPE_LABELS = { primary: '🎓 Cohort', 'cross-year': '🔗 Cross-Year' };

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.globalRing === 0;

  useEffect(() => {
    const fetchGroups = isAdmin
      ? adminApi.listAllGroups().then((res) => res.data.data)
      : groupApi.listGroups().then((res) => res.data.data);

    fetchGroups
      .then((data) => setGroups(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Groups</h1>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-accent)] bg-opacity-20 text-[var(--color-accent-light)]">
                Admin View — All Groups
              </span>
            )}
            <span className="text-sm text-[var(--color-text-muted)]">{groups.length} groups</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-lg font-semibold mb-2">No Groups Yet</h2>
            <p className="text-[var(--color-text-secondary)] text-sm">
              You&apos;ll be automatically added to groups when cohort tagging processes your email.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="glass-card p-4 flex items-center gap-4 hover:border-[var(--color-accent)] border border-transparent transition-all"
              >
                {/* Group avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-light)] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {group.displayName?.charAt(0) || group.name?.charAt(0)?.toUpperCase() || '#'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{group.displayName || group.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {TYPE_LABELS[group.type] || group.type}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      👥 {group.memberCount || group._count?.members || 0} members
                    </span>
                    {group.description && (
                      <span className="text-xs text-[var(--color-text-muted)] truncate hidden md:inline">
                        {group.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ring badge */}
                {isAdmin ? (
                  <span className="px-2.5 py-1 rounded-full text-xs text-white bg-[var(--color-accent)]">
                    Admin
                  </span>
                ) : (
                  <span className={`px-2.5 py-1 rounded-full text-xs text-white ring-badge-${Math.min(group.userRing, 3)}`}>
                    Ring {group.userRing}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

