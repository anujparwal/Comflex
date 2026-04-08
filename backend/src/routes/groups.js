/**
 * Group Routes — /api/v1/groups/*
 *
 * Handles: list groups, get group, create/update/delete, member management,
 * ring changes, permission management, mute/unmute, invites, read receipts,
 * and group avatar upload.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { requireRing, canActOnUser } = require('../middleware/ringCheck');
const { requireGroupMember, requireGroupPermission } = require('../middleware/groupPermission');
const groupService = require('../services/groupService');
const messageService = require('../services/messageService');
const { extractCohortYear, extractBranch } = require('../services/cohortService');
const { emitToGroup } = require('../services/chatSocketService');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// Multer config for group avatar uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/groups'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `group-${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Multer config for message attachments
const messageStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/messages'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `msg-${req.params.id}-${Date.now()}${ext}`);
  },
});
const messageUpload = multer({
  storage: messageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit requested by user
  fileFilter: (req, file, cb) => {
    // Images, stickers, and documents
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// All group routes require authentication
router.use(authMiddleware);

// ============================================================
// GROUP CRUD
// ============================================================

/**
 * POST /api/v1/groups/join/:token — Join a group using an invite link.
 */
router.post('/join/:token', async (req, res, next) => {
  try {
    const result = await groupService.joinViaLink(req.params.token, req.user.id);
    return success(res, result, 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * GET /api/v1/groups — List all groups the user belongs to (with unread counts).
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
 * GET /api/v1/groups/invites — List pending group invites for the current user.
 */
router.get('/invites', async (req, res, next) => {
  try {
    const invites = await groupService.listUserInvites(req.user.id);
    return success(res, invites);
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
 * Any authenticated user can create a group.
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required.'),
    body('displayName').optional().trim(),
    body('description').optional().trim(),
    body('type').optional().isIn(['primary', 'cross-year', 'custom']),
    body('memberIds').optional().isArray(),
    body('autoAdd').optional().isIn(['batch', 'branch-batch']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const group = await groupService.createGroup({
        ...req.body,
        creatorId: req.user.id,
      });

      // Add initial members (friends only — non-friends get invites)
      let memberIds = req.body.memberIds || [];
      const results = [];
      const isAutoAdd = req.body.autoAdd;
      
      // If autoAdd is checked, we enforce privileges and find auto-members
      if (isAutoAdd) {
        if (!req.user.canCreateGroups && req.user.globalRing !== 0) {
           return error(res, 'PERMISSION_DENIED', 'Only users with group creation rights can auto-add members.', 403);
        }
        
        const myYear = extractCohortYear(req.user.cohortTags);
        if (!myYear) {
          return error(res, 'NO_COHORT', 'You do not have a standard cohort year to auto-create from.', 400);
        }

        const myBranch = extractBranch(req.user.cohortTags);
        if (req.body.autoAdd === 'branch-batch' && !myBranch) {
           return error(res, 'NO_BRANCH', 'You do not have a branch tag to auto-create a branch group.', 400);
        }

        const prisma = require('../prisma');
        const queryFilter = {
             id: { not: req.user.id },
             cohortTags: { has: `cohort-${myYear}` } // Wait, cohort tag might be "cohort-28" but the year extracted might be 2028. Let's match any tag that gives >= myYear.
        };
        
        // Let's refine the query: fetch ALL users, then filter
        // Or if we know the exact string, we can do it.
        const allUsers = await prisma.user.findMany({
            where: { id: { not: req.user.id } },
            select: { id: true, cohortTags: true }
        });

        const targetIds = [];
        for (const u of allUsers) {
           const uYear = extractCohortYear(u.cohortTags);
           if (uYear && uYear >= myYear) { // Batchmates and Juniors only
               if (isAutoAdd === 'batch' && uYear === myYear) {
                   targetIds.push(u.id);
               } else if (isAutoAdd === 'branch-batch' && uYear === myYear) {
                   const uBranch = extractBranch(u.cohortTags);
                   if (uBranch === myBranch) {
                       targetIds.push(u.id);
                   }
               }
           }
        }
        memberIds = [...new Set([...memberIds, ...targetIds])];
      }

      const creatorYear = extractCohortYear(req.user.cohortTags);

      for (const memberId of memberIds) {
        try {
          // If autoAdding, we check if target is senior. Auto-added ones are already filtered, but memberIds from input need checking too.
          let bypassFriendCheck = false;
          if (isAutoAdd) {
             const prisma = require('../prisma');
             const targetUser = await prisma.user.findUnique({where: {id: memberId}, select: {id: true, cohortTags: true}});
             if (targetUser) {
                 const targetYear = extractCohortYear(targetUser.cohortTags);
                 if (targetYear && creatorYear && targetYear < creatorYear) {
                     // Skip adding senior in auto-add mode entirely!
                     results.push({ userId: memberId, error: 'Cannot auto-add seniors.' });
                     continue;
                 }
                 bypassFriendCheck = true; // For approved batchmates/juniors in autoAdd mode
             }
          }

          const result = await groupService.addMember(group.id, memberId, req.user.id, undefined, bypassFriendCheck);
          results.push({ userId: memberId, ...result });
        } catch (err) {
          results.push({ userId: memberId, error: err.message });
        }
      }

      return success(res, { group, memberResults: results }, 201);
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
 * POST /api/v1/groups/:id/avatar — Upload group avatar.
 */
router.post('/:id/avatar', requireGroupMember, requireGroupPermission('can_edit_group_info'), upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, 'NO_FILE', 'No avatar file uploaded.', 400);
    }
    const avatarUrl = `/uploads/groups/${req.file.filename}`;
    const group = await groupService.updateGroup(req.params.id, { avatarUrl });
    return success(res, group);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:id — Delete group (Admin or group creator only).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    // Allow Ring 0 admin or group creator
    const group = await groupService.getGroup(req.params.id);
    if (req.user.globalRing !== 0 && group.creatorId !== req.user.id) {
      return error(res, 'PERMISSION_DENIED', 'Only the group creator or platform admin can delete this group.', 403);
    }
    await groupService.deleteGroup(req.params.id);
    return success(res, { message: 'Group deleted.' });
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * DELETE /api/v1/groups/:id/leave — Leave a group.
 */
router.delete('/:id/leave', requireGroupMember, async (req, res, next) => {
  try {
    const group = await groupService.getGroup(req.params.id);
    if (group.creatorId === req.user.id) {
      return error(res, 'CREATOR_CANNOT_LEAVE', 'The group creator cannot leave. Transfer ownership or delete the group.', 400);
    }
    await groupService.removeMember(req.params.id, req.user.id);
    return success(res, { message: 'You have left the group.' });
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
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
 * POST /api/v1/groups/:id/members — Add a member (friends added directly, others get invites).
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

      const result = await groupService.addMember(req.params.id, req.body.userId, req.user.id);
      const status = result.invited ? 201 : 201;
      return success(res, result, status);
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
// USER SEARCH FOR GROUP INVITES
// ============================================================

/**
 * GET /api/v1/groups/:id/search-users?q=<query>
 * Search platform users to invite. Returns up to 15 results with isMember flag.
 */
router.get('/:id/search-users', requireGroupMember, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return success(res, []);

    const prisma = require('../prisma');
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        OR: [
          { username: { startsWith: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
          { email: { startsWith: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, displayName: true, username: true, avatarUrl: true, email: true,
      },
      take: 15,
      orderBy: { displayName: 'asc' },
    });

    // Tag each result with membership status
    const memberIds = (await prisma.groupMember.findMany({
      where: { groupId: req.params.id, userId: { in: users.map(u => u.id) } },
      select: { userId: true },
    })).map(m => m.userId);

    const pendingInviteIds = (await prisma.groupInvite.findMany({
      where: { groupId: req.params.id, userId: { in: users.map(u => u.id) }, status: 'pending' },
      select: { userId: true },
    })).map(i => i.userId);

    const results = users.map(u => ({
      ...u,
      isMember: memberIds.includes(u.id),
      hasPendingInvite: pendingInviteIds.includes(u.id),
    }));

    return success(res, results);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GROUP INVITES
// ============================================================

/**
 * GET /api/v1/groups/:id/invites — List pending invites for a group (admin view).
 */
router.get('/:id/invites', requireGroupMember, async (req, res, next) => {
  try {
    const invites = await groupService.listGroupInvites(req.params.id);
    return success(res, invites);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/invites — Create an invite for a non-friend user.
 */
router.post(
  '/:id/invites',
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

      const invite = await groupService.createInvite(req.params.id, req.body.userId, req.user.id);
      return success(res, invite, 201);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * POST /api/v1/groups/:id/invites/:inviteId/accept — Accept a group invite.
 */
router.post('/:id/invites/:inviteId/accept', async (req, res, next) => {
  try {
    const member = await groupService.acceptInvite(req.params.inviteId, req.user.id);
    return success(res, member);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/invites/:inviteId/reject — Reject a group invite.
 */
router.post('/:id/invites/:inviteId/reject', async (req, res, next) => {
  try {
    const result = await groupService.rejectInvite(req.params.inviteId, req.user.id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id/invite-link — Get or create the group's invite link.
 */
router.get('/:id/invite-link', requireGroupMember, requireGroupPermission('can_add_members'), async (req, res, next) => {
  try {
    const linkObj = await groupService.getInviteLink(req.params.id);
    return success(res, linkObj);
  } catch (err) {
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
// RING CONFIG (customizable ring names & count)
// ============================================================

/**
 * PATCH /api/v1/groups/:id/rings — Update ring configuration.
 * Body: { ringCount: 5, ringLabels: { "0": "Admin", "1": "Moderator", ... } }
 */
router.patch(
  '/:id/rings',
  requireGroupMember,
  requireGroupPermission('can_manage_roles'),
  async (req, res, next) => {
    try {
      const result = await groupService.updateRingConfig(req.params.id, req.body);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

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
    const result = await messageService.getMessages(req.params.id, { page, limit }, req.user.id);
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
 * PATCH /api/v1/groups/:id/messages/:msgId/react — Toggle emoji reaction on a message.
 */
router.patch('/:id/messages/:msgId/react', requireGroupMember, async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return error(res, 'VALIDATION_ERROR', 'Emoji is required.', 400);

    const msg = await messageService.toggleReaction(req.params.msgId, req.user.id, emoji);
    // Notify clients instantly of the updated reaction strip
    emitToGroup(req.params.id, 'message:react', { messageId: msg.id, reactions: msg.reactions });
    
    return success(res, msg);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/groups/:id/messages — Send a message, optionally with an attachment, reply, or forward.
 */
router.post(
  '/:id/messages',
  requireGroupMember,
  requireGroupPermission('can_send_messages'),
  messageUpload.single('attachment'),
  async (req, res, next) => {
    try {
      // Manual validation because body may be multipart form-data
      const content = (req.body.content || '').trim();
      if (!content && !req.file) {
        return error(res, 'VALIDATION_ERROR', 'Message content or attachment is required.', 400);
      }

      // Check mute status
      const muteStatus = await groupService.isMuted(req.params.id, req.user.id);
      if (muteStatus) {
        return error(res, 'USER_MUTED', `You are muted until ${muteStatus.mutedUntil.toISOString()}.`, 403);
      }

      const params = {
        content,
        mentions: req.body.mentions ? JSON.parse(req.body.mentions) : undefined,
        replyToId: req.body.replyToId || undefined,
        forwarded: req.body.forwarded === 'true',
        msgType: req.body.msgType || 'text',
      };

      if (req.file) {
        params.fileUrl = `/uploads/messages/${req.file.filename}`;
        params.fileName = req.file.originalname;
        params.fileSize = req.file.size;
        params.mimetype = req.file.mimetype;
        if (params.msgType === 'text') {
           // auto detect type
           if (req.file.mimetype.startsWith('image/')) params.msgType = 'image';
           else params.msgType = 'document';
        }
      }

      const msg = await messageService.sendMessage(req.params.id, req.user.id, params);
      
      // We don't emit a socket here because this is the fallback, the frontend usually handles its own,
      // but actually we DO want to emit here if we're uploading files so real-time clients see it.
      // E.g., when a file is uploaded, the client posts here.
      emitToGroup(req.params.id, 'message:new', msg);

      return success(res, msg, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/groups/:id/messages/read — Mark all messages in group as read.
 */
router.post('/:id/messages/read', requireGroupMember, async (req, res, next) => {
  try {
    const result = await messageService.markGroupMessagesRead(req.params.id, req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id/messages/:msgId/readby — Get who read a message.
 */
router.get('/:id/messages/:msgId/readby', requireGroupMember, async (req, res, next) => {
  try {
    const receipts = await messageService.getReadReceipts(req.params.msgId);
    return success(res, receipts);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/groups/:id/unread — Get unread count for current user.
 */
router.get('/:id/unread', requireGroupMember, async (req, res, next) => {
  try {
    const count = await groupService.getUnreadCount(req.params.id, req.user.id);
    return success(res, { unreadCount: count });
  } catch (err) {
    next(err);
  }
});

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

      // Broadcast edit to all connected clients in the group
      emitToGroup(req.params.id, 'message:edit', msg);

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

    // Broadcast deletion to all connected clients in the group
    emitToGroup(req.params.id, 'message:delete', {
      messageId: req.params.msgId,
      groupId: req.params.id,
      deletedBy: req.user.id,
    });

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
    const { msg, unpinnedIds } = await messageService.pinMessage(req.params.msgId);
    emitToGroup(req.params.id, 'message:pinnedUpdate', { pinnedMsg: msg, unpinnedIds });
    return success(res, { msg, unpinnedIds });
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
    emitToGroup(req.params.id, 'message:unpinned', { messageId: msg.id });
    return success(res, msg);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
