/**
 * MessagesPage — DM conversations list & active chat.
 * Shows all DM conversations in a sidebar and the active chat in the main area.
 * Features: read receipt tick marks (✓ sent, ✓✓ read), real-time updates.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dmApi } from '../api/dmApi';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import Layout from '../components/Layout';

export default function MessagesPage() {
  const { userId: activeUserId } = useParams();
  const { user: currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { connected, markDMRead, onEvent } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await dmApi.listConversations();
      setConversations(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, []);

  // Fetch messages for the active conversation
  const fetchMessages = useCallback(async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      const res = await dmApi.getMessages(activeUserId);
      setMessages(res.data.data?.messages || []);
      // Mark as read via socket (for real-time notification) or REST fallback
      try {
        if (connected) {
          markDMRead(activeUserId).catch(() => {});
        } else {
          await dmApi.markRead(activeUserId);
        }
      } catch {}
      // Refresh conversations to update unread counts
      await fetchConversations();
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [activeUserId, fetchConversations, connected, markDMRead]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Subscribe to real-time DM events
  useEffect(() => {
    if (!connected || !onEvent) return;

    const cleanups = [
      onEvent('dm:new', (msg) => {
        // If we're in the active conversation, add the message
        if (activeUserId && (msg.senderId === activeUserId || msg.receiverId === activeUserId)) {
          setMessages(prev => [...prev, msg]);
          // Auto-mark as read since we're viewing this conversation
          if (msg.senderId === activeUserId) {
            markDMRead(activeUserId).catch(() => {});
          }
        }
        // Refresh conversation list for unread counts
        fetchConversations();
      }),
      onEvent('dm:readUpdate', ({ readByUserId }) => {
        // The other user read our messages — update tick marks
        if (readByUserId === activeUserId) {
          setMessages(prev => prev.map(m =>
            m.senderId === currentUser?.id && !m.isRead
              ? { ...m, isRead: true, readAt: new Date().toISOString() }
              : m
          ));
        }
      }),
    ];

    return () => cleanups.forEach(fn => fn?.());
  }, [connected, onEvent, activeUserId, currentUser?.id, markDMRead, fetchConversations]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 5 seconds when in an active chat
  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [activeUserId, fetchMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeUserId) return;

    setSending(true);
    try {
      await dmApi.sendMessage(activeUserId, newMessage.trim());
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const activePartner = conversations.find(c => c.partner?.id === activeUserId)?.partner;

  // Read receipt tick component
  const ReadTick = ({ message }) => {
    if (message.senderId !== currentUser?.id) return null;
    const isRead = message.isRead;
    return (
      <span
        className={`text-[10px] ml-1 ${isRead ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
        title={isRead && message.readAt ? `Read at ${new Date(message.readAt).toLocaleTimeString()}` : 'Sent'}
      >
        {isRead ? '✓✓' : '✓'}
      </span>
    );
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] -m-8">
        {/* Conversations sidebar */}
        <div className="w-80 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-secondary)]">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold">Messages</h2>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full mt-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]" 
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-center text-[var(--color-text-muted)] py-8 text-sm">
                No conversations yet.<br />
                Send a message from your Friends page!
              </p>
            )}
            {conversations.filter(c => (c.partner?.displayName || c.partner?.username || '').toLowerCase().includes(search.toLowerCase())).map(conv => (
              <button
                key={conv.partner?.id}
                onClick={() => navigate(`/messages/${conv.partner?.id}`)}
                className={`w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-[var(--color-border)] ${
                  activeUserId === conv.partner?.id
                    ? 'bg-[rgba(108,99,255,0.1)]'
                    : 'hover:bg-[var(--color-bg-card)]'
                }`}
              >
                {conv.partner?.avatarUrl ? (
                  <img src={conv.partner.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {conv.partner?.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm truncate">{conv.partner?.displayName}</p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-[var(--color-accent)] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {conv.lastMessage?.isMine ? 'You: ' : ''}{conv.lastMessage?.content}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {activeUserId ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3 bg-[var(--color-bg-secondary)]">
                {activePartner?.avatarUrl ? (
                  <img src={activePartner.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-xs">
                    {activePartner?.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{activePartner?.displayName || 'Loading...'}</p>
                  {activePartner?.username && <p className="text-xs text-[var(--color-text-muted)]">@{activePartner.username}</p>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && <p className="text-center text-[var(--color-text-muted)] animate-pulse">Loading messages...</p>}
                {messages.map(msg => {
                  const isMine = msg.senderId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-[var(--color-accent)] text-white rounded-br-md'
                          : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-bl-md'
                      }`}>
                        <p>{msg.content}</p>
                        <div className={`flex items-center justify-end gap-0.5 mt-1 ${isMine ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                          <span className="text-[10px]">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ReadTick message={msg} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                  />
                  <button type="submit" className="btn btn-primary px-6" disabled={sending || !newMessage.trim()}>
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
              <div className="text-center">
                <p className="text-4xl mb-4">💬</p>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">or start a new one from your Friends page</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
