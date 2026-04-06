/**
 * GroupSidebar — Group members list with moderation controls.
 *
 * Shows members sorted by ring, with mute/kick/ring change controls
 * for users with appropriate permissions.
 */

import { useState, useEffect } from 'react';
import { groupApi } from '../api/groupApi';

const RING_LABELS = ['Admin', 'Manager', 'Elevated', 'Member', 'Restricted'];
const RING_COLORS = ['var(--color-danger)', 'var(--color-warning)', 'var(--color-accent)', 'var(--color-text-secondary)', 'var(--color-text-muted)'];

export default function GroupSidebar({ groupId, userPermissions = {}, currentUserId, isAdmin }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    groupApi.listMembers(groupId)
      .then((res) => setMembers(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleKick = async (userId) => {
    if (!confirm('Remove this member from the group?')) return;
    try {
      await groupApi.removeMember(groupId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to kick member.');
    }
  };

  const handleMute = async (userId) => {
    try {
      await groupApi.muteMember(groupId, userId, 60);
      alert('Member muted for 60 minutes.');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to mute member.');
    }
  };

  const handleUnmute = async (userId) => {
    try {
      await groupApi.unmuteMember(groupId, userId);
      alert('Member unmuted.');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to unmute.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Members — {members.length}
      </h3>

      <div className="space-y-1">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors group">
            {/* Avatar */}
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: RING_COLORS[Math.min(m.groupRing, 4)] }}
              >
                {m.displayName?.charAt(0)?.toUpperCase()}
              </div>
            )}

            {/* Name + Ring */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.displayName}</p>
              <p className="text-xs" style={{ color: RING_COLORS[Math.min(m.groupRing, 4)] }}>
                {RING_LABELS[m.groupRing] || `Ring ${m.groupRing}`}
              </p>
            </div>

            {/* Moderation controls */}
            {m.id !== currentUserId && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {(userPermissions.can_mute_members || isAdmin) && (
                  <button onClick={() => handleMute(m.id)} className="text-xs p-1 hover:text-[var(--color-warning)]" title="Mute">🔇</button>
                )}
                {(userPermissions.can_kick_members || isAdmin) && (
                  <button onClick={() => handleKick(m.id)} className="text-xs p-1 hover:text-[var(--color-danger)]" title="Kick">🚫</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
