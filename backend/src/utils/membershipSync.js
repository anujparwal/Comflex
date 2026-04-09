const prisma = require('../prisma');

/**
 * Checks a user's active membership based on expiry dates.
 * If the active membership has expired but a backup exists and is valid,
 * it safely downgrades the user to their backup membership.
 *
 * @param {Object} user - The user object from database
 * @returns {Object} The guaranteed synchronized user object
 */
async function syncMembership(user) {
  if (!user) return user;
  
  const now = new Date();
  let updatedUser = { ...user };
  let needsUpdate = false;
  let updateData = {};

  if (user.subscriptionExpiry && user.subscriptionExpiry < now) {
    if (user.backupSubscriptionExpiry && user.backupSubscriptionExpiry > now) {
      // Restore valid backup subscription (e.g. Ultra Weekly expired, falling back to Pro Yearly)
      updateData = {
        subscriptionPlan: user.backupSubscriptionPlan,
        subscriptionExpiry: user.backupSubscriptionExpiry,
        backupSubscriptionPlan: null,
        backupSubscriptionExpiry: null
      };
      
      updatedUser.subscriptionPlan = user.backupSubscriptionPlan;
      updatedUser.subscriptionExpiry = user.backupSubscriptionExpiry;
    } else {
      // Both expired or no backup
      updateData = {
        subscriptionPlan: 'free',
        subscriptionExpiry: null,
        backupSubscriptionPlan: null,
        backupSubscriptionExpiry: null
      };
      
      updatedUser.subscriptionPlan = 'free';
      updatedUser.subscriptionExpiry = null;
    }
    
    updatedUser.backupSubscriptionPlan = null;
    updatedUser.backupSubscriptionExpiry = null;
    needsUpdate = true;
  }

  // Also clean up stale backups to avoid keeping old data forever
  if (!needsUpdate && user.backupSubscriptionExpiry && user.backupSubscriptionExpiry < now) {
    updateData.backupSubscriptionPlan = null;
    updateData.backupSubscriptionExpiry = null;
    updatedUser.backupSubscriptionPlan = null;
    updatedUser.backupSubscriptionExpiry = null;
    needsUpdate = true;
  }

  if (needsUpdate) {
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
  }

  return updatedUser;
}

module.exports = { syncMembership };
