/**
 * MessageBubble — Single chat message component.
 *
 * Displays avatar, name, badges, content, timestamp, and action buttons
 * (edit, delete, pin) based on user permissions.
 */

import { useState } from 'react';

const RING_COLORS = {
  0: 'var(--color-danger)',
  1: 'var(--color-warning)',
  2: 'var(--color-accent)',
};

export default function MessageBubble({ message, currentUserId, permissions = {}, isAdmin, onEdit, onDelete, onPin }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwn = message.authorId === currentUserId;
  const canDelete = isOwn || permissions.can_delete_others_messages || isAdmin;
  const canPin = permissions.can_pin_messages || isAdmin;
  const author = message.author || {};

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent.trim());
    }
    setEditing(false);
  };

  const ringColor = RING_COLORS[author.globalRing] || 'var(--color-text-muted)';

  return (
    <div className={`flex gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--color-bg-secondary)] group ${message.isDeleted ? 'opacity-50' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: ringColor }}
          >
            {author.displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm" style={{ color: ringColor }}>{author.displayName || 'Unknown'}</span>
          {/* Badges */}
          {author.displayBadges?.slice(0, 3).map((badge, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">{badge}</span>
          ))}
          <span className="text-xs text-[var(--color-text-muted)]">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.editedAt && <span className="text-xs text-[var(--color-text-muted)]">(edited)</span>}
          {message.isPinned && <span className="text-xs">📌</span>}
        </div>

        {editing ? (
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="flex-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-1.5"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="text-xs text-[var(--color-success)] hover:underline">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-[var(--color-text-muted)] hover:underline">Cancel</button>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)] break-words">{message.content}</p>
        )}
      </div>

      {/* Actions */}
      {!message.isDeleted && (
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwn && !editing && (
            <button onClick={() => { setEditContent(message.content); setEditing(true); }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1" title="Edit">
              ✏️
            </button>
          )}
          {canPin && (
            <button onClick={() => onPin?.(message.id, !message.isPinned)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1" title={message.isPinned ? 'Unpin' : 'Pin'}>
              📌
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete?.(message.id)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] p-1" title="Delete">
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
