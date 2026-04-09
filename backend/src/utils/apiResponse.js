/**
 * API Response Helpers
 * 
 * Standardized JSON response format as defined in RULES.md §4.
 * Every API response MUST use these helpers to ensure consistency.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {object} data - The response payload
 * @param {number} statusCode - HTTP status code (default 200)
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} code - Error code (e.g. "VALIDATION_ERROR")
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {Array} details - Optional field-level error details
 */
function error(res, code, message, statusCode = 400, details = []) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details.length > 0 && { details }),
    },
  });
}

module.exports = { success, error };
