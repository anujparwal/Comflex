/**
 * Message Service
 *
 * Business logic for chat messages: send, edit, delete, pin/unpin.
 * All permission checks are enforced at the route layer or here.
 */

const prisma = require('../prisma');

/**
 * Get paginated messages for a group (newest first).
 */
async function getMessages(groupId, { page = 1, limit = 50 } = {}) {
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
      },
    }),
    prisma.message.count({ where: { groupId } }),
  ]);

  return {
    messages: messages.map(formatMessage),
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
    },
  });
  if (!msg) throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });
  return formatMessage(msg);
}

/**
 * Send a new message.
 */
async function sendMessage(groupId, authorId, { content, mentions = [], attachments = [] }) {
  const msg = await prisma.message.create({
    data: { groupId, authorId, content, mentions, attachments },
    include: {
      author: {
        select: {
          id: true, displayName: true, avatarUrl: true,
          globalRing: true, displayBadges: true,
        },
      },
    },
  });
  return formatMessage(msg);
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
    },
  });
  return formatMessage(updated);
}

/**
 * Delete a message (soft delete — marks as deleted).
 * Users can delete their own; those with can_delete_others_messages can delete any.
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

/**
 * Format a message for API response.
 */
function formatMessage(msg) {
  return {
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
  };
}

module.exports = {
  getMessages, getMessage, sendMessage, editMessage, deleteMessage,
  pinMessage, unpinMessage, getPinnedMessages,
};
