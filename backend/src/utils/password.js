/**
 * Password Utility
 * 
 * bcrypt wrappers for hashing and comparing passwords.
 * Uses cost factor 12 as specified in RULES.md.
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} plaintext - The raw password
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plaintext - The raw password to check
 * @param {string} hash - The stored bcrypt hash
 * @returns {Promise<boolean>} True if they match
 */
async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, comparePassword };
