/**
 * useSocket — Socket.IO client hook for real-time chat.
 *
 * Connects on authentication, auto-disconnects on logout.
 * Exposes: socket instance, connection status, and helper methods.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

const SOCKET_URL = window.location.origin;

export function useSocket() {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated]);

  const sendMessage = useCallback((groupId, content, mentions = []) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        return reject(new Error('Not connected'));
      }
      socketRef.current.emit('message:send', { groupId, content, mentions }, (response) => {
        if (response?.error) reject(new Error(response.error));
        else resolve(response?.message);
      });
    });
  }, []);

  const startTyping = useCallback((groupId) => {
    socketRef.current?.emit('typing:start', { groupId });
  }, []);

  const stopTyping = useCallback((groupId) => {
    socketRef.current?.emit('typing:stop', { groupId });
  }, []);

  const onEvent = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    sendMessage,
    startTyping,
    stopTyping,
    onEvent,
  };
}
