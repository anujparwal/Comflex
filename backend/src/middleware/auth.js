/**
 * Auth Middleware
 * 
 * Verifies the JWT access token from the Authorization header.
 * Attaches the decoded user payload to `req.user` for downstream use.
 * 
 * Usage: router.get('/protected', authMiddleware, handler)
 */

const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/apiResponse');

function authMiddleware(req, res, next) {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'AUTH_REQUIRED', 'Authentication required. Please provide a valid token.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return error(res, 'AUTH_REQUIRED', 'Authentication required. Token is missing.', 401);
    }

    // Verify and decode the token
    const decoded = verifyAccessToken(token);

    // Attach user payload to request for downstream middleware/routes
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      globalRing: decoded.globalRing,
      cohortTags: decoded.cohortTags,
      displayBadges: decoded.displayBadges,
      avatarUrl: decoded.avatarUrl,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'TOKEN_EXPIRED', 'Access token has expired. Please refresh.', 401);
    }
    return error(res, 'INVALID_TOKEN', 'Invalid authentication token.', 401);
  }
}

module.exports = authMiddleware;
