/**
 * Chat Socket Service — Socket.IO WebSocket Server
 *
 * Handles real-time messaging: send/receive messages, typing indicators,
 * and moderation events (mute, kick, ring changes).
 *
 * Authentication: JWT verification on handshake.
 * Rooms: each group ID is a Socket.IO room.
 */

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../prisma');
const messageService = require('./messageService');
const groupService = require('./groupService');

let io;

/**
 * Initialize Socket.IO on the HTTP server.
 */
function initSocket(httpServer, frontendUrl) {
  io = new Server(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Authentication Middleware ──────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));

    try {
      const decoded = verifyAccessToken(token);
      socket.user = {
        id: decoded.sub,
        email: decoded.email,
        globalRing: decoded.globalRing,
        displayName: decoded.displayName || decoded.email,
      };
      next();
    } catch {
      next(new Error('Invalid or expired token.'));
    }
  });

  // ── Connection Handler ────────────────────────────────
  io.on('connection', async (socket) => {
    console.log(`[WS] ✅ Connected: ${socket.user.email} (${socket.id})`);

    // Auto-join all group rooms the user belongs to
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId: socket.user.id },
        select: { groupId: true },
      });
      for (const m of memberships) {
        socket.join(m.groupId);
      }
      console.log(`[WS] Joined ${memberships.length} rooms for ${socket.user.email}`);
    } catch (err) {
      console.error(`[WS] Failed to join rooms for ${socket.user.email}:`, err.message);
    }

    // ── message:send ──────────────────────────────────────
    socket.on('message:send', async (data, callback) => {
      try {
        const { groupId, content, mentions = [], attachments = [] } = data;
        if (!groupId || !content?.trim()) {
          return callback?.({ error: 'groupId and content are required.' });
        }

        // Check membership
        const membership = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId } },
        });
        if (!membership && socket.user.globalRing !== 0) {
          return callback?.({ error: 'Not a member of this group.' });
        }

        // Check permissions
        const perms = membership?.permissions || {};
        if (!perms.can_send_messages && socket.user.globalRing !== 0) {
          return callback?.({ error: 'You do not have permission to send messages.' });
        }

        // Check mute
        const muteStatus = await groupService.isMuted(groupId, socket.user.id);
        if (muteStatus) {
          return callback?.({ error: `Muted until ${muteStatus.mutedUntil.toISOString()}` });
        }

        const msg = await messageService.sendMessage(groupId, socket.user.id, {
          content: content.trim(),
          mentions,
          attachments,
        });

        // Broadcast to room
        io.to(groupId).emit('message:new', msg);
        callback?.({ success: true, message: msg });
      } catch (err) {
        console.error('[WS] message:send error:', err.message);
        callback?.({ error: err.message });
      }
    });

    // ── typing:start ────────────────────────────────────
    socket.on('typing:start', ({ groupId }) => {
      if (groupId) {
        socket.to(groupId).emit('typing:start', {
          userId: socket.user.id,
          displayName: socket.user.displayName,
          groupId,
        });
      }
    });

    // ── typing:stop ─────────────────────────────────────
    socket.on('typing:stop', ({ groupId }) => {
      if (groupId) {
        socket.to(groupId).emit('typing:stop', {
          userId: socket.user.id,
          groupId,
        });
      }
    });

    // ── disconnect ──────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[WS] ❌ Disconnected: ${socket.user.email} (${reason})`);
    });
  });

  return io;
}

/**
 * Get the Socket.IO instance (for emitting from routes/services).
 */
function getIO() {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket first.');
  return io;
}

/**
 * Emit a moderation event to a group room.
 */
function emitToGroup(groupId, event, data) {
  if (io) io.to(groupId).emit(event, data);
}

module.exports = { initSocket, getIO, emitToGroup };
