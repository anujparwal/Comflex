/**
 * DM Routes — /api/v1/dm/*
 *
 * Handles: list conversations, get/send messages, mark read, delete.
 * All routes require authentication + friendship with the target user.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const dmService = require('../services/dmService');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// All DM routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/dm — List all DM conversations.
 * Returns partner info, last message, and unread count.
 */
router.get('/', async (req, res, next) => {
  try {
    const conversations = await dmService.listConversations(req.user.id);
    return success(res, conversations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/dm/:userId — Get messages with a specific user.
 * Query: ?page=1&limit=50
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await dmService.getConversation(req.user.id, req.params.userId, { page, limit });
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * POST /api/v1/dm/:userId — Send a DM to a user.
 * Body: { content: string }
 */
router.post(
  '/:userId',
  [body('content').trim().notEmpty().withMessage('Message content is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const message = await dmService.sendDM(req.user.id, req.params.userId, req.body.content);
      return success(res, message, 201);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/dm/:userId/read — Mark all messages from a user as read.
 */
router.patch('/:userId/read', async (req, res, next) => {
  try {
    const result = await dmService.markAsRead(req.user.id, req.params.userId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/dm/messages/:msgId — Soft-delete a DM (own messages only).
 */
router.delete('/messages/:msgId', async (req, res, next) => {
  try {
    const result = await dmService.deleteDM(req.params.msgId, req.user.id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

module.exports = router;
