/**
 * Auth Service
 * 
 * Business logic for authentication: register, login, refresh token.
 * Registration is gated — only allowed after the Seed Admin configures
 * the institution (isConfigured === true).
 */

const prisma = require('../prisma');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { assignCohortTags } = require('./cohortService');

/**
 * Register a new user.
 * 1. Check institution is configured (registration gate)
 * 2. Check email is not already taken
 * 3. Hash password, create user
 * 4. Auto-assign cohort tags
 * 5. Return JWT pair
 */
async function register(email, password, displayName) {
  // Gate: institution must be configured before registration is allowed
  const config = await prisma.institutionConfig.findFirst();
  if (!config || !config.isConfigured) {
    throw Object.assign(new Error('Registration is disabled. The platform has not been configured yet.'), { statusCode: 403, code: 'REGISTRATION_DISABLED' });
  }

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409, code: 'DUPLICATE_EMAIL' });
  }

  // Create the user with hashed password
  const hashedPw = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPw,
      displayName,
      globalRing: 3, // Default: Member
      cohortTags: [],
      displayBadges: [],
    },
  });

  // Auto-assign cohort tags based on email parsing rules
  const tags = await assignCohortTags(user.id, email);

  // Fetch the updated user (with tags)
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

  // Generate tokens
  const accessToken = signAccessToken(updatedUser);
  const refreshToken = signRefreshToken(updatedUser.id);

  // Store hashed refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(updatedUser),
  };
}

/**
 * Login an existing user.
 * 1. Find user by email
 * 2. Compare password hash
 * 3. Return JWT pair
 */
async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  // Generate tokens
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);

  // Store refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

/**
 * Refresh an access token using a valid refresh token.
 */
async function refreshAccessToken(token) {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token.'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || user.refreshToken !== token) {
    throw Object.assign(new Error('Refresh token has been revoked.'), { statusCode: 401, code: 'TOKEN_REVOKED' });
  }

  const accessToken = signAccessToken(user);
  return { accessToken };
}

/**
 * Logout — invalidate the refresh token.
 */
async function logout(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

/**
 * Forgot Password — generate a reset token and log it to console.
 * In production, this would send an email with the reset URL.
 *
 * @param {string} email - The user's email address
 */
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether the email exists — always return success
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // Generate a random reset token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Store hashed token + 1 hour expiry
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // TODO: Replace with real email transport in production
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
  console.log(`\n📧 [PASSWORD RESET] Token for ${email}:`);
  console.log(`   URL: ${resetUrl}`);
  console.log(`   Raw token: ${rawToken}\n`);

  return { message: 'If that email exists, a reset link has been sent.' };
}

/**
 * Reset Password — validate the token, update the password, clear the token.
 *
 * @param {string} token - The raw reset token from the URL
 * @param {string} newPassword - The new password
 */
async function resetPassword(token, newPassword) {
  // Hash the incoming token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    throw Object.assign(
      new Error('Invalid or expired reset token.'),
      { statusCode: 400, code: 'INVALID_RESET_TOKEN' }
    );
  }

  // Update password and clear reset token
  const hashedPw = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPw,
      resetToken: null,
      resetTokenExpiry: null,
      refreshToken: null, // Invalidate all sessions
    },
  });

  return { message: 'Password has been reset successfully. Please log in.' };
}

/**
 * Strip sensitive fields before returning user data to the client.
 */
function sanitizeUser(user) {
  const { password, refreshToken, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

module.exports = { register, login, refreshAccessToken, logout, forgotPassword, resetPassword, sanitizeUser };
