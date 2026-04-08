/**
 * Message Service
 *
 * Business logic for chat messages: send, edit, delete, pin/unpin,
 * read receipts, and unread tracking.
 */

const prisma = require('../prisma');

/**
 * Get paginated messages for a group (newest first), with read receipt info.
 */
async function getMessages(groupId, { page = 1, limit = 50 } = {}, currentUserId = null) {
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: {
          select: {
            id: true, displayName: true, avatarUrl: true,
            globalRing: true, displayBadges: true,
          },
        },
        readReceipts: {
          select: {
            userId: true,
            readAt: true,
          },
        },
        _count: { select: { readReceipts: true } },
      },
    }),
    prisma.message.count({ where: { groupId } }),
  ]);

  return {
    messages: messages.map(msg => formatMessage(msg, currentUserId)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a single message by ID.
 */
async function getMessage(messageId) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
      readReceipts: {
        select: { userId: true, readAt: true },
      },
      _count: { select: { readReceipts: true } },
    },
  });
  if (!msg) throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });
  return formatMessage(msg);
}

/**
 * Send a new message.
 */
async function sendMessage(groupId, authorId, params) {
  const { content, mentions = [], attachments = [], replyToId, forwarded = false, msgType = 'text', fileUrl, fileName, fileSize, mimetype } = params;
  const msg = await prisma.message.create({
    data: { 
      groupId, authorId, content, mentions, attachments,
      replyToId, forwarded, msgType, fileUrl, fileName, fileSize, mimetype
    },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
    },
  });

  // Auto-create read receipt for the author
  await prisma.messageReadReceipt.create({
    data: { messageId: msg.id, userId: authorId },
  }).catch(() => {}); // Ignore if already exists

  return formatMessage({ ...msg, readReceipts: [{ userId: authorId, readAt: new Date() }], _count: { readReceipts: 1 } });
}

/**
 * Edit own message (only content can change).
 */
async function editMessage(messageId, userId, newContent) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });
  if (msg.authorId !== userId) {
    throw Object.assign(new Error('You can only edit your own messages.'), { statusCode: 403, code: 'NOT_AUTHOR' });
  }
  if (msg.isDeleted) {
    throw Object.assign(new Error('Cannot edit a deleted message.'), { statusCode: 400, code: 'MESSAGE_DELETED' });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: newContent, editedAt: new Date() },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
      readReceipts: {
        select: { userId: true, readAt: true },
      },
      _count: { select: { readReceipts: true } },
    },
  });
  return formatMessage(updated);
}

/**
 * Delete a message (soft delete — marks as deleted).
 */
async function deleteMessage(messageId, userId, canDeleteOthers = false) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });

  if (msg.authorId !== userId && !canDeleteOthers) {
    throw Object.assign(new Error('You do not have permission to delete this message.'), { statusCode: 403, code: 'PERMISSION_DENIED' });
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, content: '[Message deleted]' },
  });
}

/**
 * Toggle a reaction on a message.
 */
async function toggleReaction(messageId, userId, emoji) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });

  // Reactions are structured as { "👍": ["userId1", "userId2"] }
  const currentReactions = msg.reactions || {};
  let usersForEmoji = currentReactions[emoji] || [];

  if (usersForEmoji.includes(userId)) {
    // Remove if already reacted
    usersForEmoji = usersForEmoji.filter(id => id !== userId);
  } else {
    // Add reaction
    usersForEmoji.push(userId);
  }

  // If no users left, remove the emoji key entirely
  const updatedReactions = { ...currentReactions };
  if (usersForEmoji.length === 0) {
    delete updatedReactions[emoji];
  } else {
    updatedReactions[emoji] = usersForEmoji;
  }

  const updatedMsg = await prisma.message.update({
    where: { id: messageId },
    data: { reactions: updatedReactions },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
      readReceipts: { select: { userId: true, readAt: true } },
      _count: { select: { readReceipts: true } },
    },
  });
  return formatMessage(updatedMsg);
}

/**
 * Pin a message.
 */
async function pinMessage(messageId) {
  return prisma.message.update({
    where: { id: messageId },
    data: { isPinned: true },
  });
}

/**
 * Unpin a message.
 */
async function unpinMessage(messageId) {
  return prisma.message.update({
    where: { id: messageId },
    data: { isPinned: false },
  });
}

/**
 * Get all pinned messages in a group.
 */
async function getPinnedMessages(groupId) {
  const messages = await prisma.message.findMany({
    where: { groupId, isPinned: true, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
    },
  });
  return messages.map(formatMessage);
}

// ============================================================
// READ RECEIPTS
// ============================================================

/**
 * Mark a single message as read by a user.
 */
async function markMessageRead(messageId, userId) {
  return prisma.messageReadReceipt.upsert({
    where: { messageId_userId: { messageId, userId } },
    update: { readAt: new Date() },
    create: { messageId, userId },
  });
}

/**
 * Mark all unread messages in a group as read for a user.
 * Returns the count of newly-read messages.
 */
async function markGroupMessagesRead(groupId, userId) {
  // Get all message IDs in this group that the user hasn't read yet
  const unreadMessages = await prisma.message.findMany({
    where: {
      groupId,
      isDeleted: false,
      authorId: { not: userId },
      readReceipts: {
        none: { userId },
      },
    },
    select: { id: true },
  });

  if (unreadMessages.length === 0) return { markedCount: 0 };

  // Create read receipts in batch
  const receipts = unreadMessages.map(m => ({
    messageId: m.id,
    userId,
  }));

  // Use createMany for efficiency (skipDuplicates is not supported on MongoDB)
  try {
    const result = await prisma.messageReadReceipt.createMany({
      data: receipts,
    });
    return { markedCount: result.count };
  } catch (err) {
    // If a duplicate constraint error occurs during race conditions, just return 0
    return { markedCount: 0 };
  }
}

/**
 * Get read receipts for a specific message.
 */
async function getReadReceipts(messageId) {
  const receipts = await prisma.messageReadReceipt.findMany({
    where: { messageId },
    orderBy: { readAt: 'desc' },
  });

  const userIds = receipts.map(r => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, avatarUrl: true, username: true },
  });

  return receipts.map(r => ({
    ...r,
    user: users.find(u => u.id === r.userId),
  }));
}

/**
 * Format a message for API response.
 */
function formatMessage(msg, currentUserId = null) {
  const base = {
    id: msg.id,
    groupId: msg.groupId,
    authorId: msg.authorId,
    author: msg.author || null,
    content: msg.isDeleted ? '[Message deleted]' : msg.content,
    attachments: msg.attachments || [],
    mentions: msg.mentions || [],
    isPinned: msg.isPinned,
    isDeleted: msg.isDeleted,
    createdAt: msg.createdAt,
    editedAt: msg.editedAt,
    
    // Extensions
    replyToId: msg.replyToId || null,
    reactions: msg.reactions || {},
    forwarded: msg.forwarded || false,
    msgType: msg.msgType || 'text',
    fileUrl: msg.fileUrl || null,
    fileName: msg.fileName || null,
    fileSize: msg.fileSize || null,
    mimetype: msg.mimetype || null,
  };

  // Add read receipt summary if available
  if (msg._count) {
    base.readCount = msg._count.readReceipts || 0;
  }
  if (msg.readReceipts) {
    base.readBy = msg.readReceipts.slice(0, 5).map(r => r.userId);
    if (currentUserId) {
      base.isReadByMe = msg.readReceipts.some(r => r.userId === currentUserId);
    }
  }

  return base;
}

module.exports = {
  getMessages, getMessage, sendMessage, editMessage, deleteMessage,
  pinMessage, unpinMessage, getPinnedMessages, toggleReaction,
  markMessageRead, markGroupMessagesRead, getReadReceipts,
};
