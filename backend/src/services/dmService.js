/**
 * DM (Direct Message) Service
 *
 * Business logic for 1-on-1 personal messaging between friends.
 * DMs require an accepted friendship between the two users.
 */

const prisma = require('../prisma');

/**
 * Check that two users are friends (accepted friendship exists).
 * Throws if not friends.
 */
async function requireFriendship(userId, otherUserId) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
  });

  if (!friendship) {
    throw Object.assign(
      new Error('You can only message friends. Send a friend request first.'),
      { statusCode: 403, code: 'NOT_FRIENDS' }
    );
  }

  return friendship;
}

/**
 * Send a direct message to a friend.
 */
async function sendDM(senderId, receiverId, content) {
  if (senderId === receiverId) {
    throw Object.assign(new Error('Cannot message yourself.'), { statusCode: 400, code: 'SELF_MESSAGE' });
  }

  // Verify friendship
  await requireFriendship(senderId, receiverId);

  // Verify receiver exists
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const message = await prisma.directMessage.create({
    data: { senderId, receiverId, content },
  });

  return message;
}

/**
 * Get paginated conversation between two users.
 */
async function getConversation(userId, otherUserId, { page = 1, limit = 50 } = {}) {
  // Verify friendship
  await requireFriendship(userId, otherUserId);

  const skip = (page - 1) * limit;

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      isDeleted: false,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const total = await prisma.directMessage.count({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      isDeleted: false,
    },
  });

  return {
    messages: messages.reverse(), // Return in chronological order
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * List all DM conversations for a user — returns the other user's info
 * plus the last message and unread count.
 */
async function listConversations(userId) {
  // Get all DMs involving this user
  const allDMs = await prisma.directMessage.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      isDeleted: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by conversation partner
  const conversationMap = new Map();
  for (const dm of allDMs) {
    const partnerId = dm.senderId === userId ? dm.receiverId : dm.senderId;
    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        lastMessage: dm,
        unreadCount: 0,
      });
    }
    // Count unread messages sent TO this user
    if (dm.receiverId === userId && !dm.isRead) {
      const entry = conversationMap.get(partnerId);
      entry.unreadCount++;
    }
  }

  // Fetch partner user data
  const partnerIds = Array.from(conversationMap.keys());
  const partners = await prisma.user.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  });

  // Build response
  return partnerIds.map(partnerId => {
    const { lastMessage, unreadCount } = conversationMap.get(partnerId);
    const partner = partners.find(p => p.id === partnerId);
    return {
      partner,
      lastMessage: {
        content: lastMessage.content,
        createdAt: lastMessage.createdAt,
        isMine: lastMessage.senderId === userId,
      },
      unreadCount,
    };
  });
}

/**
 * Mark all messages from a specific user as read.
 */
async function markAsRead(userId, otherUserId) {
  await prisma.directMessage.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: userId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });

  return { message: 'Messages marked as read.' };
}

/**
 * Soft-delete a DM (only the sender can delete their own message).
 */
async function deleteDM(messageId, userId) {
  const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw Object.assign(new Error('Message not found.'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (message.senderId !== userId) {
    throw Object.assign(new Error('You can only delete your own messages.'), { statusCode: 403, code: 'NOT_SENDER' });
  }

  await prisma.directMessage.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  return { message: 'Message deleted.' };
}

module.exports = { sendDM, getConversation, listConversations, markAsRead, deleteDM };
