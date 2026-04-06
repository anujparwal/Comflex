/**
 * Group Service
 *
 * Business logic for group CRUD, membership management,
 * ring/permission changes, and mute/unmute operations.
 */

const prisma = require('../prisma');
const { canActOnUser } = require('../middleware/ringCheck');

/**
 * List all groups the user belongs to.
 */
async function listUserGroups(userId) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.group,
    memberCount: m.group._count.members,
    userRing: m.ring,
    userPermissions: m.permissions,
  }));
}

/**
 * Get a single group with member count.
 */
async function getGroup(groupId) {
  const group = await prisma.cohortGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404, code: 'GROUP_NOT_FOUND' });
  return { ...group, memberCount: group._count.members };
}

/**
 * Create a new group.
 */
async function createGroup({ name, displayName, description, type = 'primary' }) {
  const existing = await prisma.cohortGroup.findUnique({ where: { name } });
  if (existing) throw Object.assign(new Error('A group with this name already exists.'), { statusCode: 409, code: 'DUPLICATE_GROUP' });

  return prisma.cohortGroup.create({
    data: { name, displayName, description, type },
  });
}

/**
 * Update group info.
 */
async function updateGroup(groupId, updates) {
  const allowed = {};
  if (updates.displayName !== undefined) allowed.displayName = updates.displayName;
  if (updates.description !== undefined) allowed.description = updates.description;
  if (updates.avatarUrl !== undefined) allowed.avatarUrl = updates.avatarUrl;

  return prisma.cohortGroup.update({ where: { id: groupId }, data: allowed });
}

/**
 * Delete a group and all associated data.
 */
async function deleteGroup(groupId) {
  await prisma.cohortGroup.delete({ where: { id: groupId } });
}

/**
 * List group members with user profile data.
 */
async function listMembers(groupId) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          globalRing: true, cohortTags: true, displayBadges: true, cfHandle: true, cfRating: true,
        },
      },
    },
    orderBy: { ring: 'asc' },
  });

  return members.map((m) => ({
    ...m.user,
    groupRing: m.ring,
    permissions: m.permissions,
    joinedAt: m.joinedAt,
  }));
}

/**
 * Get a user's membership in a group.
 */
async function getMembership(groupId, userId) {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) throw Object.assign(new Error('User is not a member of this group.'), { statusCode: 404, code: 'NOT_A_MEMBER' });
  return membership;
}

/**
 * Add a member to a group with default Ring 3 permissions.
 */
async function addMember(groupId, userId, ring = 3) {
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (existing) throw Object.assign(new Error('User is already a member.'), { statusCode: 409, code: 'ALREADY_MEMBER' });

  const defaultPermissions = ring <= 2
    ? {
        can_send_messages: true, can_delete_own_messages: true,
        can_delete_others_messages: true, can_mute_members: true,
        can_kick_members: true, can_add_members: true, can_tag_members: true,
        can_manage_economy: false, can_create_events: false, can_pin_messages: true,
        can_manage_roles: false, can_edit_group_info: false, can_stop_others_tagging: true,
      }
    : {
        can_send_messages: true, can_delete_own_messages: true,
        can_delete_others_messages: false, can_mute_members: false,
        can_kick_members: false, can_add_members: false, can_tag_members: true,
        can_manage_economy: false, can_create_events: false, can_pin_messages: false,
        can_manage_roles: false, can_edit_group_info: false, can_stop_others_tagging: false,
      };

  return prisma.groupMember.create({
    data: { userId, groupId, ring, permissions: defaultPermissions },
  });
}

/**
 * Remove (kick) a member from a group.
 */
async function removeMember(groupId, userId) {
  await prisma.groupMember.delete({
    where: { userId_groupId: { userId, groupId } },
  });
}

/**
 * Get a member's ring in a group.
 */
async function getMemberRing(groupId, userId) {
  const m = await getMembership(groupId, userId);
  return { ring: m.ring };
}

/**
 * Set a member's ring in a group. Enforces ring hierarchy.
 */
async function setMemberRing(groupId, actorRing, targetUserId, newRing) {
  const target = await getMembership(groupId, targetUserId);

  if (!canActOnUser(actorRing, target.ring)) {
    throw Object.assign(new Error('Cannot modify ring of a user at your level or above.'), { statusCode: 403, code: 'RING_VIOLATION' });
  }

  return prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { ring: newRing },
  });
}

/**
 * Get a member's permissions.
 */
async function getMemberPermissions(groupId, userId) {
  const m = await getMembership(groupId, userId);
  return m.permissions || {};
}

/**
 * Set a member's permissions.
 */
async function setMemberPermissions(groupId, actorRing, targetUserId, permissions) {
  const target = await getMembership(groupId, targetUserId);

  if (!canActOnUser(actorRing, target.ring)) {
    throw Object.assign(new Error('Cannot modify permissions of a user at your level or above.'), { statusCode: 403, code: 'RING_VIOLATION' });
  }

  return prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { permissions },
  });
}

/**
 * Mute a member in a group for a given duration.
 */
async function muteMember(groupId, targetUserId, mutedByUserId, durationMinutes = 60) {
  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

  return prisma.muteRecord.upsert({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    update: { mutedUntil, mutedBy: mutedByUserId },
    create: { userId: targetUserId, groupId, mutedBy: mutedByUserId, mutedUntil },
  });
}

/**
 * Unmute a member by deleting the mute record.
 */
async function unmuteMember(groupId, targetUserId) {
  await prisma.muteRecord.deleteMany({
    where: { userId: targetUserId, groupId },
  });
}

/**
 * Check if a user is currently muted in a group.
 */
async function isMuted(groupId, userId) {
  const mute = await prisma.muteRecord.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!mute) return false;
  if (mute.mutedUntil < new Date()) {
    // Mute expired — clean up
    await prisma.muteRecord.delete({ where: { id: mute.id } });
    return false;
  }
  return { muted: true, mutedUntil: mute.mutedUntil };
}

module.exports = {
  listUserGroups, getGroup, createGroup, updateGroup, deleteGroup,
  listMembers, getMembership, addMember, removeMember,
  getMemberRing, setMemberRing, getMemberPermissions, setMemberPermissions,
  muteMember, unmuteMember, isMuted,
};
