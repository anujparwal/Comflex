/**
 * Auth Routes — /api/v1/auth/*
 * 
 * Handles: register, login, logout, refresh token.
 * See /docs/api/auth.md for the full contract.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

/**
 * POST /api/v1/auth/register
 * Create a new user account. Triggers cohort auto-tagging.
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('displayName').trim().isLength({ min: 2, max: 50 }).withMessage('Display name must be 2–50 characters.'),
  ],
  async (req, res, next) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400, 
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const { email, password, displayName } = req.body;
      const result = await authService.register(email, password, displayName);
      return success(res, result, 201);
    } catch (err) {
      if (err.statusCode) {
        return error(res, err.code, err.message, err.statusCode);
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticate and receive JWT + refresh token.
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) {
        return error(res, err.code, err.message, err.statusCode);
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Issue a new access token using a valid refresh token.
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const result = await authService.refreshAccessToken(req.body.refreshToken);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) {
        return error(res, err.code, err.message, err.statusCode);
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Invalidate the current session / refresh token.
 */
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    return success(res, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/forgot-password
 * Send a password reset email (console-logged in dev).
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('A valid email is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const result = await authService.forgotPassword(req.body.email);
      return success(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Reset password using the token from the reset email.
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const result = await authService.resetPassword(req.body.token, req.body.newPassword);
      return success(res, result);
    } catch (err) {
      if (err.statusCode) {
        return error(res, err.code, err.message, err.statusCode);
      }
      next(err);
    }
  }
);

module.exports = router;
