/**
 * ChatPage — Full chat interface for a single group.
 *
 * Real-time messaging via Socket.IO, message history via REST,
 * typing indicators, pinned messages, and member sidebar.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { groupApi } from '../api/groupApi';
import Layout from '../components/Layout';
import MessageBubble from '../components/MessageBubble';
import GroupSidebar from '../components/GroupSidebar';

export default function ChatPage() {
  const { id: groupId } = useParams();
  const { user } = useAuth();
  const { connected, sendMessage: wsSendMessage, startTyping, stopTyping, onEvent } = useSocket();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [membership, setMembership] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isAdmin = user?.globalRing === 0;

  // Load group info and messages
  useEffect(() => {
    if (!groupId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [groupRes, msgsRes] = await Promise.all([
          groupApi.getGroup(groupId),
          groupApi.getMessages(groupId, 1, 50),
        ]);
        setGroup(groupRes.data.data);
        setMessages(msgsRes.data.data.messages.reverse()); // oldest first

        // Get user's membership/permissions
        try {
          const membersRes = await groupApi.listMembers(groupId);
          const me = membersRes.data.data.find((m) => m.id === user?.id);
          if (me) setMembership(me);
        } catch { /* ignore */ }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };

    loadData();
  }, [groupId, user?.id]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!connected || !onEvent) return;

    const cleanups = [
      onEvent('message:new', (msg) => {
        if (msg.groupId === groupId) {
          setMessages((prev) => [...prev, msg]);
        }
      }),
      onEvent('message:edit', (msg) => {
        if (msg.groupId === groupId) {
          setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
        }
      }),
      onEvent('message:delete', ({ messageId, groupId: gid }) => {
        if (gid === groupId) {
          setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m));
        }
      }),
      onEvent('typing:start', ({ userId, displayName, groupId: gid }) => {
        if (gid === groupId && userId !== user?.id) {
          setTypingUsers((prev) => {
            if (prev.find((u) => u.userId === userId)) return prev;
            return [...prev, { userId, displayName }];
          });
        }
      }),
      onEvent('typing:stop', ({ userId, groupId: gid }) => {
        if (gid === groupId) {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        }
      }),
    ];

    return () => cleanups.forEach((fn) => fn?.());
  }, [connected, onEvent, groupId, user?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = useCallback((e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      startTyping(groupId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => stopTyping(groupId), 2000);
    } else {
      stopTyping(groupId);
    }
  }, [groupId, startTyping, stopTyping]);

  // Send message
  const handleSend = async (e) => {
    e?.preventDefault();
    const content = messageInput.trim();
    if (!content || sending) return;

    setSending(true);
    stopTyping(groupId);
    setMessageInput('');

    try {
      if (connected) {
        await wsSendMessage(groupId, content);
      } else {
        const res = await groupApi.sendMessage(groupId, { content });
        setMessages((prev) => [...prev, res.data.data]);
      }
    } catch (err) {
      alert(err.message || 'Failed to send message.');
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  // Edit message
  const handleEdit = async (msgId, newContent) => {
    try {
      const res = await groupApi.editMessage(groupId, msgId, newContent);
      setMessages((prev) => prev.map((m) => m.id === msgId ? res.data.data : m));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to edit.');
    }
  };

  // Delete message
  const handleDelete = async (msgId) => {
    try {
      await groupApi.deleteMessage(groupId, msgId);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete.');
    }
  };

  // Pin/unpin
  const handlePin = async (msgId, shouldPin) => {
    try {
      if (shouldPin) await groupApi.pinMessage(groupId, msgId);
      else await groupApi.unpinMessage(groupId, msgId);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isPinned: shouldPin } : m));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to pin/unpin.');
    }
  };

  const userPerms = membership?.permissions || {};

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="skeleton h-8 w-48 mb-4" />
          <div className="skeleton h-96 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-120px)] fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 flex-shrink-0">
          <Link to="/groups" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            ← Back
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-light)] flex items-center justify-center text-white font-bold">
            {group?.displayName?.charAt(0) || '#'}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{group?.displayName || group?.name}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {group?.memberCount} members
              {connected && <span className="ml-2 text-[var(--color-success)]">● Live</span>}
              {!connected && <span className="ml-2 text-[var(--color-warning)]">● Reconnecting...</span>}
            </p>
          </div>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="btn btn-secondary text-sm px-3 py-1.5"
          >
            👥 {showSidebar ? 'Hide' : 'Members'}
          </button>
        </div>

        {/* Main area */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Chat panel */}
          <div className="flex-1 flex flex-col glass-card overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                  No messages yet. Start the conversation! 💬
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    currentUserId={user?.id}
                    permissions={userPerms}
                    isAdmin={isAdmin}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="px-4 py-1 text-xs text-[var(--color-text-muted)] animate-pulse">
                {typingUsers.map((u) => u.displayName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-[var(--color-border)]">
              <input
                type="text"
                value={messageInput}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || sending}
                className="btn btn-primary px-5 py-2.5"
              >
                {sending ? '...' : 'Send'}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="w-64 glass-card overflow-y-auto flex-shrink-0 hidden md:block">
              <GroupSidebar
                groupId={groupId}
                userPermissions={userPerms}
                currentUserId={user?.id}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
