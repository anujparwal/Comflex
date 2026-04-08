/**
 * MessageBubble — Single chat message component.
 *
 * Displays avatar, name, badges, content (with @mention highlighting),
 * timestamp, read receipts, and action buttons (edit, delete, pin)
 * based on user permissions.
 */

import { useState, useMemo } from 'react';
import { groupApi } from '../api/groupApi';

const RING_COLORS = {
  0: 'var(--color-danger)',
  1: 'var(--color-warning)',
  2: 'var(--color-accent)',
};

/**
 * Parse message content and replace @mentions with highlighted spans.
 * mentionData: array of { userId, displayName } from the mentions field.
 */
function renderContentWithMentions(content, mentionData = [], onUserClick) {
  if (!mentionData.length) return content;

  // Build a map of displayName → userId for matching
  const mentionMap = {};
  mentionData.forEach(m => {
    if (m.displayName) mentionMap[m.displayName.toLowerCase()] = m.userId;
  });

  // Build regex for URLs and Mentions
  const mentionNames = mentionData
    .filter(m => m.displayName)
    .map(m => m.displayName)
    .sort((a, b) => b.length - a.length);

  const escaped = mentionNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionPattern = escaped.length > 0 ? `@(${escaped.join('|')})` : null;
  const urlPattern = `(https?:\\/\\/[^\\s]+)`;
  const combinedPattern = mentionPattern ? `${urlPattern}|${mentionPattern}` : urlPattern;
  
  const regex = new RegExp(combinedPattern, 'gi');

  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    
    if (match[1]) {
      // It's a URL
      parts.push(
        <a key={match.index} href={match[1]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline break-all" onClick={e => e.stopPropagation()}>
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      // It's a Mention
      const matchedName = match[2];
      const userId = mentionMap[matchedName.toLowerCase()];
      parts.push(
        <span
          key={match.index}
          className="mention-chip"
          onClick={(e) => { e.stopPropagation(); userId && onUserClick?.(userId); }}
          style={{ cursor: userId ? 'pointer' : 'default' }}
        >
          @{matchedName}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts.length > 0 ? parts : content;
}

export default function MessageBubble({ message, currentUserId, permissions = {}, isAdmin, onEdit, onDelete, onPin, onUserClick, groupId, members = [], onReply, onForward, onReact, replyMessage, isFriend }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReadBy, setShowReadBy] = useState(false);
  const [readByUsers, setReadByUsers] = useState([]);
  const [loadingReadBy, setLoadingReadBy] = useState(false);

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

  const handleAuthorClick = () => {
    if (!isOwn && onUserClick) onUserClick(message.authorId);
  };

  const handleShowReadBy = async () => {
    if (showReadBy) {
      setShowReadBy(false);
      return;
    }
    if (!groupId) return;
    setLoadingReadBy(true);
    try {
      const res = await groupApi.getMessageReadBy(groupId, message.id);
      setReadByUsers(res.data.data || []);
      setShowReadBy(true);
    } catch {
      setReadByUsers([]);
      setShowReadBy(true);
    } finally {
      setLoadingReadBy(false);
    }
  };

  // Build mention data from mentions array + members
  const mentionData = useMemo(() => {
    const mentionIds = message.mentions || [];
    if (!mentionIds.length || !members.length) return [];
    return mentionIds.map(id => {
      const member = members.find(m => m.id === id);
      return member ? { userId: id, displayName: member.displayName } : null;
    }).filter(Boolean);
  }, [message.mentions, members]);

  const readCount = message.readCount || 0;

  const renderedContent = useMemo(() => {
    if (message.isDeleted) return message.content;
    return renderContentWithMentions(message.content, mentionData, onUserClick);
  }, [message.content, message.isDeleted, mentionData, onUserClick]);

  return (
    <div id={`msg-${message.id}`} className={`flex gap-3 p-3 rounded-xl transition-colors group relative ${message.isDeleted ? 'opacity-50' : 'transition-all duration-500'} hover:bg-[var(--color-bg-secondary)]`}>
      {/* Avatar */}
      <div className="flex-shrink-0 cursor-pointer" onClick={handleAuthorClick}>
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
        {/* Forwarded Header */}
        {message.forwarded && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] mb-1 font-medium">
            <span>➦ Forwarded</span>
          </div>
        )}
        
        {/* Replied Snippet */}
        {replyMessage && (
          <div 
            className="flex flex-col p-1.5 mb-1.5 rounded-md border-l-2 bg-black/10 dark:bg-white/5 border-[var(--color-accent)] text-xs cursor-pointer hover:bg-black/20 dark:hover:bg-white/10"
            onClick={() => {
              // Could scroll to original message, but keep it simple for now
            }}
          >
            <span className="font-semibold" style={{ color: RING_COLORS[replyMessage.author?.globalRing] || 'var(--color-text-muted)' }}>
              {replyMessage.author?.displayName || 'Unknown'}
            </span>
            <span className="text-[var(--color-text-secondary)] truncate">
              {replyMessage.msgType === 'text' ? replyMessage.content : `[${replyMessage.msgType}]`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm cursor-pointer hover:underline" style={{ color: ringColor }} onClick={handleAuthorClick}>{author.displayName || 'Unknown'}</span>
          {/* Friend Status Badge removed */}
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
          <div>
            {/* Main Text Content */}
            {message.content && (
              <p className={`text-sm text-[var(--color-text-secondary)] break-words ${message.msgType === 'sticker' ? 'text-4xl' : ''}`}>
                {renderedContent}
              </p>
            )}

            {/* Multimedia Attachments */}
            {message.msgType === 'image' && message.fileUrl && (
              <div className="mt-2 rounded-xl overflow-hidden max-w-sm border border-[var(--color-border)]">
                <img src={message.fileUrl} alt={message.fileName} className="w-full h-auto object-contain cursor-pointer hover:opacity-90" onClick={() => window.open(message.fileUrl, '_blank')} />
              </div>
            )}
            
            {message.msgType === 'document' && message.fileUrl && (
              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card)] transition">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="text-2xl">📄</div>
                  <div className="truncate">
                    <p className="text-sm font-semibold truncate text-[var(--color-text-primary)]">{message.fileName}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{message.fileSize ? (message.fileSize / 1024).toFixed(1) + ' KB' : 'Document'}</p>
                  </div>
                </div>
                <div className="text-[var(--color-accent)]">⬇</div>
              </a>
            )}
            
            {message.msgType === 'sticker' && message.fileUrl && (
              <div className="mt-2">
                <img src={message.fileUrl} alt="Sticker" className="w-32 h-32 object-contain drop-shadow-lg" />
              </div>
            )}
          </div>
        )}

        {/* Reactions removed as requested */}

        {/* Read receipts indicator */}
        {!message.isDeleted && readCount > 0 && (
          <div className="mt-1 relative">
            <button
              onClick={handleShowReadBy}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1"
            >
              <span className="text-[10px]">👁</span>
              <span>{readCount > 1 ? `Read by ${readCount}` : 'Read'}</span>
              {loadingReadBy && <span className="animate-pulse">...</span>}
            </button>

            {/* Read by popover */}
            {showReadBy && (
              <div className="absolute bottom-full left-0 mb-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 shadow-lg z-10 min-w-[200px] max-w-[300px] max-h-[200px] overflow-y-auto">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Read by</p>
                {readByUsers.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">No read receipts</p>
                ) : (
                  <div className="space-y-1.5">
                    {readByUsers.map(r => (
                      <div key={r.userId} className="flex items-center gap-2">
                        {r.user?.avatarUrl ? (
                          <img src={r.user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-[8px] font-bold">
                            {r.user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="text-xs flex-1">{r.user?.displayName}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover Actions */}
      {!message.isDeleted && (
        <div className="relative group/actions flex items-start opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute right-0 top-0 flex items-center bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-sm gap-0.5 overflow-hidden">
            {/* Built-in React Dropdown trigger */}
            {/* Reaction button removed */}

            <button onClick={() => onReply?.(message)} className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] p-1.5" title="Reply">
              ↩️
            </button>
            <button onClick={() => onForward?.(message)} className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] p-1.5" title="Forward">
              ➦
            </button>
            <button onClick={() => {
              const textToCopy = message.content || message.fileUrl;
              if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).catch(() => {});
              } else {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                  document.execCommand('copy');
                } catch (err) {
                  // Ignore
                }
                textArea.remove();
              }
            }} className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] p-1.5" title="Copy">
              📄
            </button>

            {isOwn && !editing && (
              <button onClick={() => { setEditContent(message.content); setEditing(true); }}
                className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] p-1.5" title="Edit">
                ✏️
              </button>
            )}
            {canPin && (
              <button onClick={() => onPin?.(message.id, !message.isPinned)}
                className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] p-1.5" title={message.isPinned ? 'Unpin' : 'Pin'}>
                📌
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete?.(message.id)}
                className="text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] p-1.5" title="Delete">
                🗑️
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
