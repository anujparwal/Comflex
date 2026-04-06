/**
 * Admin Routes — /api/v1/admin/*
 * 
 * All routes require Ring 0 (Admin) unless otherwise specified.
 * Handles: institution config, cohort config, user management.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { requireRing, validateElevation } = require('../middleware/ringCheck');
const userService = require('../services/userService');
const { retagUser } = require('../services/cohortService');
const prisma = require('../prisma');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// All admin routes require authentication + Ring 0
router.use(authMiddleware, requireRing(0));

// ============================================================
// INSTITUTION CONFIG
// ============================================================

/**
 * POST /api/v1/admin/institution/setup
 * Initial institution configuration (first-boot wizard).
 */
router.post(
  '/institution/setup',
  [
    body('name').trim().notEmpty().withMessage('Institution name is required.'),
    body('domain').trim().notEmpty().withMessage('Domain is required.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const config = await prisma.institutionConfig.findFirst();
      if (!config) {
        return error(res, 'CONFIG_MISSING', 'InstitutionConfig not found. Run seed first.', 500);
      }

      const updated = await prisma.institutionConfig.update({
        where: { id: config.id },
        data: {
          name: req.body.name,
          domain: req.body.domain,
          logoUrl: req.body.logoUrl || null,
          isConfigured: true,
        },
      });

      return success(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/institution
 * Retrieve current institution settings.
 */
router.get('/institution', async (req, res, next) => {
  try {
    const config = await prisma.institutionConfig.findFirst();
    return success(res, config);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/institution
 * Update institution settings.
 */
router.patch('/institution', async (req, res, next) => {
  try {
    const config = await prisma.institutionConfig.findFirst();
    if (!config) return error(res, 'CONFIG_MISSING', 'InstitutionConfig not found.', 500);

    const allowed = {};
    if (req.body.name !== undefined) allowed.name = req.body.name;
    if (req.body.domain !== undefined) allowed.domain = req.body.domain;
    if (req.body.logoUrl !== undefined) allowed.logoUrl = req.body.logoUrl;

    const updated = await prisma.institutionConfig.update({
      where: { id: config.id },
      data: allowed,
    });

    return success(res, updated);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// COHORT CONFIG (EMAIL PARSING RULES)
// ============================================================

/**
 * GET /api/v1/admin/cohort-config
 * Retrieve current email parsing rules.
 */
router.get('/cohort-config', async (req, res, next) => {
  try {
    const config = await prisma.institutionConfig.findFirst();
    return success(res, {
      emailParsingRules: config?.emailParsingRules || null,
      cohortConfig: config?.cohortConfig || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/cohort-config
 * Update email parsing regex / domain rules.
 */
router.put(
  '/cohort-config',
  [
    body('emailParsingRules').isObject().withMessage('emailParsingRules must be an object.'),
    body('emailParsingRules.pattern').isString().withMessage('Pattern is required.'),
    body('emailParsingRules.captureGroup').isInt({ min: 0 }).withMessage('captureGroup must be a non-negative integer.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      // Validate the regex pattern is valid
      try {
        new RegExp(req.body.emailParsingRules.pattern);
      } catch {
        return error(res, 'INVALID_REGEX', 'The provided regex pattern is invalid.', 400);
      }

      const config = await prisma.institutionConfig.findFirst();
      if (!config) return error(res, 'CONFIG_MISSING', 'InstitutionConfig not found.', 500);

      const updated = await prisma.institutionConfig.update({
        where: { id: config.id },
        data: {
          emailParsingRules: req.body.emailParsingRules,
          cohortConfig: req.body.cohortConfig || config.cohortConfig || {
            seniorOffset: -1,
            juniorOffset: 1,
            seniorAutoElevate: true,
          },
          isConfigured: true,
        },
      });

      return success(res, {
        emailParsingRules: updated.emailParsingRules,
        cohortConfig: updated.cohortConfig,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/cohort-config/preview
 * Test a regex against a sample email (dry run).
 */
router.post(
  '/cohort-config/preview',
  [
    body('email').isEmail().withMessage('A valid test email is required.'),
    body('pattern').isString().withMessage('Pattern is required.'),
    body('captureGroup').isInt({ min: 0 }).withMessage('captureGroup must be a non-negative integer.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      const { email, pattern, captureGroup, yearOffset = 0 } = req.body;

      let regex;
      try {
        regex = new RegExp(pattern);
      } catch {
        return error(res, 'INVALID_REGEX', 'The provided regex pattern is invalid.', 400);
      }

      const match = email.match(regex);
      if (!match || !match[captureGroup]) {
        return success(res, {
          matched: false,
          extractedYear: null,
          predictedTags: [],
          message: 'Email did not match the pattern.',
        });
      }

      const year = parseInt(match[captureGroup], 10) + yearOffset;
      const primaryName = `cohort-${year}`;
      const crossSenior = `cohort-${Math.min(year, year - 1)}-${Math.max(year, year - 1)}`;
      const crossJunior = `cohort-${Math.min(year, year + 1)}-${Math.max(year, year + 1)}`;

      return success(res, {
        matched: true,
        extractedYear: year,
        predictedTags: [primaryName, crossSenior, crossJunior],
        message: `Extracted year: ${year}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// USER MANAGEMENT
// ============================================================

/**
 * GET /api/v1/admin/users (alias handled via /api/v1/users in admin context)
 * List all users with search/filter.
 */
router.get('/users', async (req, res, next) => {
  try {
    const { search, ring, page, limit } = req.query;
    const result = await userService.listUsers({
      search,
      ring,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/users/:id
 * Retrieve any user's profile.
 */
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return success(res, user);
  } catch (err) {
    if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/users/:id/ring
 * Change a user's global ring level.
 */
router.patch(
  '/users/:id/ring',
  [body('ring').isInt({ min: 0 }).withMessage('Ring must be a non-negative integer.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
          errors.array().map(e => ({ field: e.path, issue: e.msg }))
        );
      }

      // Get the target user's current ring
      const targetUser = await userService.getUserById(req.params.id);

      // Validate the elevation/de-elevation
      const validation = validateElevation(
        req.user.globalRing,
        targetUser.globalRing,
        req.body.ring
      );

      if (!validation.valid) {
        return error(res, 'RING_VIOLATION', validation.reason, 403);
      }

      const user = await userService.setUserRing(req.params.id, req.body.ring);
      return success(res, user);
    } catch (err) {
      if (err.statusCode) return error(res, err.code, err.message, err.statusCode);
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/users/:id/retag
 * Re-process a user's email and reassign cohort tags.
 */
router.post('/users/:id/retag', async (req, res, next) => {
  try {
    const tags = await retagUser(req.params.id);
    return success(res, { cohortTags: tags, message: 'User re-tagged successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
