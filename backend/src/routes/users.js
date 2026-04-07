/**
 * User Routes — /api/v1/users/*
 * 
 * Handles: get own profile, update profile, upload avatar.
 * See /docs/api/users.md for the full contract.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const userService = require('../services/userService');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// ============================================================
// Avatar Upload Config (multer)
// Stored locally in /uploads for dev; use S3 in production.
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

/**
 * GET /api/v1/users/me
 * Retrieve the authenticated user's profile.
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    return success(res, user);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * PATCH /api/v1/users/me
 * Update display name, bio, badge selection, CF handle, personal email, etc.
 */
router.patch(
  '/me',
  authMiddleware,
  [
    body('displayName').optional().trim().isLength({ min: 2, max: 50 }),
    body('bio').optional().isLength({ max: 500 }),
    body('displayBadges').optional().isArray({ max: 5 }),
    body('cfHandle').optional().isString(),
    body('personalEmail').optional().isEmail().withMessage('Invalid personal email.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      // If setting personal email, trigger verification
      if (req.body.personalEmail) {
        const authService = require('../services/authService');
        await authService.sendPersonalEmailVerification(req.user.id, req.body.personalEmail);
        delete req.body.personalEmail; // Don't pass to generic update
      }

      const user = await userService.updateProfile(req.user.id, req.body);
      return success(res, user);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * POST /api/v1/users/me/avatar
 * Upload a profile picture (JPEG/PNG/WebP, max 5MB).
 */
router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, 'UPLOAD_REQUIRED', 'No file uploaded. Please attach an image.', 400);
    }

    // In production, this would be an S3 URL; in dev, it's a local path
    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await userService.updateAvatar(req.user.id, avatarUrl);
    return success(res, user);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/users/me/tags
 * Retrieve the current user's cohort tags.
 */
router.get('/me/tags', authMiddleware, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    return success(res, { cohortTags: user.cohortTags });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
