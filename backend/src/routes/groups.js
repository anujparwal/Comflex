/**
 * Group Routes — /api/v1/groups/*
 *
 * Handles: list groups, get group, create/update/delete, member management,
 * ring changes, permission management, mute/unmute.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { requireRing, canActOnUser } = require('../middleware/ringCheck');
const { requireGroupMember, requireGroupPermission } = require('../middleware/groupPermission');
const groupService = require('../services/groupService');
const messageService = require('../services/messageService');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// All group routes require authentication
router.use(authMiddleware);

// ============================================================
// GROUP CRUD
// ============================================================

/**
 * GET /api/v1/groups — List all groups the user belongs to.
 */
router.get('/', async (req, res, next) => {
  try {
    const groups = await groupService.listUserGroups(req.user.id);
    return success(res, groups);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id — Get group info.
 */
router.get('/:id', requireGroupMember, async (req, res, next) => {
  try {
    const group = await groupService.getGroup(req.params.id);
    return success(res, group);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/groups — Create a new group.
 * Allowed for: Ring ≤ 1 (Admin/Manager) OR user with canCreateGroups flag.
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required.'),
    body('displayName').optional().trim(),
    body('description').optional().trim(),
    body('type').optional().isIn(['primary', 'cross-year', 'custom']),
  ],
  async (req, res, next) => {
    try {
      // Check permission: Ring ≤ 1 OR canCreateGroups
      if (req.user.globalRing > 1) {
        const prisma = require('../prisma');
        const fullUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!fullUser?.canCreateGroups) {
          return error(res, 'INSUFFICIENT_RING', 'You do not have permission to create groups.', 403);
        }
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const group = await groupService.createGroup(req.body);
      return success(res, group, 201);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/groups/:id — Update group info.
 */
router.patch('/:id', requireGroupMember, requireGroupPermission('can_edit_group_info'), async (req, res, next) => {
  try {
    const group = await groupService.updateGroup(req.params.id, req.body);
    return success(res, group);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:id — Delete group (Admin only).
 */
router.delete('/:id', requireRing(0), async (req, res, next) => {
  try {
    await groupService.deleteGroup(req.params.id);
    return success(res, { message: 'Group deleted.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// MEMBERS
// ============================================================

/**
 * GET /api/v1/groups/:id/members — List group members.
 */
router.get('/:id/members', requireGroupMember, async (req, res, next) => {
  try {
    const members = await groupService.listMembers(req.params.id);
    return success(res, members);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/members — Add a member.
 */
router.post(
  '/:id/members',
  requireGroupMember,
  requireGroupPermission('can_add_members'),
  [body('userId').notEmpty().withMessage('userId is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const member = await groupService.addMember(req.params.id, req.body.userId);
      return success(res, member, 201);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/groups/:id/members/:userId — Kick a member.
 */
router.delete('/:id/members/:userId', requireGroupMember, requireGroupPermission('can_kick_members'), async (req, res, next) => {
  try {
    // Verify ring hierarchy: actor must outrank target
    const targetMembership = await groupService.getMembership(req.params.id, req.params.userId);
    const actorRing = req.groupMembership?.ring ?? req.user.globalRing;

    if (!canActOnUser(actorRing, targetMembership.ring)) {
      return error(res, 'RING_VIOLATION', 'Cannot kick a user at your level or above.', 403);
    }

    await groupService.removeMember(req.params.id, req.params.userId);
    return success(res, { message: 'Member removed.' });
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

// ============================================================
// MUTE / UNMUTE
// ============================================================

/**
 * POST /api/v1/groups/:id/members/:userId/mute — Mute a member.
 */
router.post(
  '/:id/members/:userId/mute',
  requireGroupMember,
  requireGroupPermission('can_mute_members'),
  async (req, res, next) => {
    try {
      const targetMembership = await groupService.getMembership(req.params.id, req.params.userId);
      const actorRing = req.groupMembership?.ring ?? req.user.globalRing;

      if (!canActOnUser(actorRing, targetMembership.ring)) {
        return error(res, 'RING_VIOLATION', 'Cannot mute a user at your level or above.', 403);
      }

      const duration = parseInt(req.body.durationMinutes, 10) || 60;
      const mute = await groupService.muteMember(req.params.id, req.params.userId, req.user.id, duration);
      return success(res, mute);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/groups/:id/members/:userId/mute — Unmute a member.
 */
router.delete('/:id/members/:userId/mute', requireGroupMember, requireGroupPermission('can_mute_members'), async (req, res, next) => {
  try {
    await groupService.unmuteMember(req.params.id, req.params.userId);
    return success(res, { message: 'Member unmuted.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// RING & PERMISSIONS (per-group)
// ============================================================

/**
 * GET /api/v1/groups/:id/members/:userId/ring
 */
router.get('/:id/members/:userId/ring', requireGroupMember, async (req, res, next) => {
  try {
    const result = await groupService.getMemberRing(req.params.id, req.params.userId);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * PATCH /api/v1/groups/:id/members/:userId/ring
 */
router.patch(
  '/:id/members/:userId/ring',
  requireGroupMember,
  requireGroupPermission('can_manage_roles'),
  [body('ring').isInt({ min: 0 }).withMessage('Ring must be a non-negative integer.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const actorRing = req.groupMembership?.ring ?? req.user.globalRing;
      const result = await groupService.setMemberRing(req.params.id, actorRing, req.params.userId, req.body.ring);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * GET /api/v1/groups/:id/members/:userId/permissions
 */
router.get('/:id/members/:userId/permissions', requireGroupMember, async (req, res, next) => {
  try {
    const perms = await groupService.getMemberPermissions(req.params.id, req.params.userId);
    return success(res, perms);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * PATCH /api/v1/groups/:id/members/:userId/permissions
 */
router.patch(
  '/:id/members/:userId/permissions',
  requireGroupMember,
  requireGroupPermission('can_manage_roles'),
  async (req, res, next) => {
    try {
      const actorRing = req.groupMembership?.ring ?? req.user.globalRing;
      const result = await groupService.setMemberPermissions(req.params.id, actorRing, req.params.userId, req.body);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

// ============================================================
// MESSAGES (REST fallback — prefer WebSocket for real-time)
// ============================================================

/**
 * GET /api/v1/groups/:id/messages — Paginated message history.
 */
router.get('/:id/messages', requireGroupMember, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await messageService.getMessages(req.params.id, { page, limit });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id/messages/pinned — List pinned messages.
 */
router.get('/:id/messages/pinned', requireGroupMember, async (req, res, next) => {
  try {
    const messages = await messageService.getPinnedMessages(req.params.id);
    return success(res, messages);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id/messages/:msgId — Get a single message.
 */
router.get('/:id/messages/:msgId', requireGroupMember, async (req, res, next) => {
  try {
    const msg = await messageService.getMessage(req.params.msgId);
    return success(res, msg);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/messages — Send a message (REST fallback).
 */
router.post(
  '/:id/messages',
  requireGroupMember,
  requireGroupPermission('can_send_messages'),
  [body('content').trim().notEmpty().withMessage('Message content is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      // Check mute status
      const muteStatus = await groupService.isMuted(req.params.id, req.user.id);
      if (muteStatus) {
        return error(res, 'USER_MUTED', `You are muted until ${muteStatus.mutedUntil.toISOString()}.`, 403);
      }

      const msg = await messageService.sendMessage(req.params.id, req.user.id, req.body);
      return success(res, msg, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/groups/:id/messages/:msgId — Edit own message.
 */
router.patch(
  '/:id/messages/:msgId',
  requireGroupMember,
  [body('content').trim().notEmpty().withMessage('Content is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const msg = await messageService.editMessage(req.params.msgId, req.user.id, req.body.content);
      return success(res, msg);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/groups/:id/messages/:msgId — Delete a message.
 */
router.delete('/:id/messages/:msgId', requireGroupMember, async (req, res, next) => {
  try {
    const perms = req.groupMembership?.permissions || {};
    const msg = await messageService.deleteMessage(req.params.msgId, req.user.id, perms.can_delete_others_messages || req.user.globalRing === 0);
    return success(res, { message: 'Message deleted.' });
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/messages/:msgId/pin — Pin a message.
 */
router.post('/:id/messages/:msgId/pin', requireGroupMember, requireGroupPermission('can_pin_messages'), async (req, res, next) => {
  try {
    const msg = await messageService.pinMessage(req.params.msgId);
    return success(res, msg);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:id/messages/:msgId/pin — Unpin a message.
 */
router.delete('/:id/messages/:msgId/pin', requireGroupMember, requireGroupPermission('can_pin_messages'), async (req, res, next) => {
  try {
    const msg = await messageService.unpinMessage(req.params.msgId);
    return success(res, msg);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
