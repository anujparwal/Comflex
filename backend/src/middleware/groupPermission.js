/**
 * Group Permission Middleware
 *
 * Factory middleware that verifies a user has a specific permission
 * in the group specified by the route's :id param.
 *
 * MUST be used after authMiddleware so req.user is available.
 * Reads the group membership from DB and checks the permission key.
 * Ring 0 (global admin) bypasses all permission checks.
 *
 * Usage:
 *   router.post('/groups/:id/messages', auth, requireGroupPermission('can_send_messages'), handler)
 */

const prisma = require('../prisma');
const { error } = require('../utils/apiResponse');

/**
 * Check that the current user is a member of the group and attach membership to req.
 */
async function requireGroupMember(req, res, next) {
  try {
    const groupId = req.params.id || req.params.groupId;
    if (!groupId) return error(res, 'MISSING_GROUP', 'Group ID is required.', 400);

    // Ring 0 bypasses membership check
    if (req.user.globalRing === 0) {
      req.groupMembership = { ring: 0, permissions: {} };
      return next();
    }

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId } },
      include: { group: { select: { ringConfig: true, creatorId: true } } },
    });

    if (!membership) {
      return error(res, 'NOT_A_MEMBER', 'You are not a member of this group.', 403);
    }

    req.groupMembership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Factory: creates middleware that checks a specific permission key.
 * Must be used after requireGroupMember.
 */
function requireGroupPermission(permissionKey) {
  return (req, res, next) => {
    // Ring 0 bypasses
    if (req.user.globalRing === 0) return next();

    const membership = req.groupMembership;
    if (!membership) {
      return error(res, 'NOT_A_MEMBER', 'You are not a member of this group.', 403);
    }

    // Evaluate permissions: merge member specific + ring specific
    const memberPerms = membership.permissions || {};
    const ringPerms = membership.group?.ringConfig?.ringPermissions?.[membership.groupRing] || {};
    // A permission is true if AT LEAST one of the memberPerms or ringPerms is true
    const hasPermission = memberPerms[permissionKey] === true || ringPerms[permissionKey] === true;

    if (!hasPermission && membership.group?.creatorId !== req.user.id) {
      return error(res, 'PERMISSION_DENIED', `You do not have the "${permissionKey}" permission in this group.`, 403);
    }

    next();
  };
}

module.exports = { requireGroupMember, requireGroupPermission };
