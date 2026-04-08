const express = require('express');
const { body, param, validationResult } = require('express-validator');
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Middleware to validate request
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'VALIDATION_ERROR', 'Invalid input.', 400,
      errors.array().map(e => ({ field: e.path, issue: e.msg }))
    );
  }
  next();
};

/**
 * GET /api/v1/events
 * List targeted and public upcoming events.
 */
router.get('/', eventController.listEvents);

/**
 * GET /api/v1/events/manage
 * List events the user is an organizer of.
 */
router.get('/manage', eventController.listManagedEvents);

/**
 * GET /api/v1/events/:id
 * Get full event details.
 */
router.get('/:id',
  [param('id').isMongoId().withMessage('Invalid Event ID.')],
  validate,
  eventController.getEvent
);

/**
 * POST /api/v1/events
 * Create a new main event or sub-event.
 */
router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('startDate').isISO8601().toDate().withMessage('A valid start date is required.'),
    body('category').trim().notEmpty().withMessage('Category is required.'),
  ],
  validate,
  eventController.createEvent
);

/**
 * PATCH /api/v1/events/:id
 * Update an event.
 */
router.patch('/:id',
  [param('id').isMongoId().withMessage('Invalid Event ID.')],
  validate,
  eventController.updateEvent
);

/**
 * DELETE /api/v1/events/:id
 * Cancel/delete an event.
 */
router.delete('/:id',
  [param('id').isMongoId().withMessage('Invalid Event ID.')],
  validate,
  eventController.deleteEvent
);

/**
 * POST /api/v1/events/:id/teams
 * Create a team for an event.
 */
router.post('/:id/teams',
  [
    param('id').isMongoId().withMessage('Invalid Event ID.'),
    body('name').trim().notEmpty().withMessage('Team name is required.')
  ],
  validate,
  eventController.createTeam
);

/**
 * GET /api/v1/events/:id/teams
 * List teams for an event.
 */
router.get('/:id/teams',
  [param('id').isMongoId().withMessage('Invalid Event ID.')],
  validate,
  eventController.listTeams
);

/**
 * POST /api/v1/events/:id/teams/:teamId/invites
 * Invite a user to a team.
 */
router.post('/:id/teams/:teamId/invites',
  [
    param('id').isMongoId().withMessage('Invalid Event ID.'),
    param('teamId').isMongoId().withMessage('Invalid Team ID.'),
    body('userId').isMongoId().withMessage('User ID is required to invite.')
  ],
  validate,
  eventController.inviteToTeam
);

/**
 * POST /api/v1/events/:id/teams/invites/:inviteId/accept
 * Accept a team invite.
 */
router.post('/:id/teams/invites/:inviteId/accept',
  [
    param('id').isMongoId().withMessage('Invalid Event ID.'),
    param('inviteId').isMongoId().withMessage('Invalid Invite ID.')
  ],
  validate,
  eventController.acceptTeamInvite
);

/**
 * POST /api/v1/events/:id/teams/invites/:inviteId/reject
 * Reject a team invite.
 */
router.post('/:id/teams/invites/:inviteId/reject',
  [
    param('id').isMongoId().withMessage('Invalid Event ID.'),
    param('inviteId').isMongoId().withMessage('Invalid Invite ID.')
  ],
  validate,
  eventController.rejectTeamInvite
);

module.exports = router;
