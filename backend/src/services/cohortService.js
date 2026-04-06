/**
 * Cohort Tagging Service
 * 
 * Implements admin-controlled email-based auto-tagging.
 * The Admin configures regex patterns via the dashboard;
 * this service applies those patterns to extract cohort years
 * and assign users to groups.
 * 
 * See RULES.md §5 for the full tagging specification.
 */

const prisma = require('../prisma');

/**
 * Parse a user's email using the admin-configured parsing rules
 * and assign them to the appropriate cohort groups.
 * 
 * @param {string} userId - The user's database ID
 * @param {string} email - The user's email address
 * @returns {Promise<string[]>} Array of assigned cohort tag names
 */
async function assignCohortTags(userId, email) {
  // Fetch the institution's email parsing configuration
  const config = await prisma.institutionConfig.findFirst();

  if (!config || !config.isConfigured || !config.emailParsingRules) {
    console.warn('[COHORT] Institution not configured — skipping auto-tagging.');
    return [];
  }

  const rules = config.emailParsingRules;
  const cohortConfig = config.cohortConfig || { seniorOffset: -1, juniorOffset: 1, seniorAutoElevate: true };

  // Apply the regex pattern to extract the year identifier
  let regex;
  try {
    regex = new RegExp(rules.pattern);
  } catch (err) {
    console.error('[COHORT] Invalid regex pattern in config:', rules.pattern, err.message);
    return [];
  }

  const match = email.match(regex);
  if (!match || !match[rules.captureGroup]) {
    console.warn(`[COHORT] Email "${email}" did not match pattern. No tags assigned.`);
    return [];
  }

  const yearStr = match[rules.captureGroup];
  const year = parseInt(yearStr, 10) + (rules.yearOffset || 0);

  if (isNaN(year)) {
    console.warn(`[COHORT] Extracted year "${yearStr}" is not a valid number.`);
    return [];
  }

  // Determine the group names
  const primaryName = `cohort-${year}`;
  const seniorYear = year + cohortConfig.seniorOffset; // e.g., 27 for year 28
  const juniorYear = year + cohortConfig.juniorOffset; // e.g., 29 for year 28

  // Cross-year group names — always use the canonical form (lower-higher)
  const crossSeniorName = `cohort-${Math.min(year, seniorYear)}-${Math.max(year, seniorYear)}`;
  const crossJuniorName = `cohort-${Math.min(year, juniorYear)}-${Math.max(year, juniorYear)}`;

  const tags = [primaryName, crossSeniorName, crossJuniorName];

  // Create groups if they don't exist and add the user as a member
  for (const tagName of tags) {
    // Determine group type
    const isPrimary = tagName === primaryName;
    const type = isPrimary ? 'primary' : 'cross-year';

    // Upsert the group
    let group = await prisma.cohortGroup.findUnique({ where: { name: tagName } });
    if (!group) {
      group = await prisma.cohortGroup.create({
        data: {
          name: tagName,
          displayName: isPrimary 
            ? `Class of 20${year}` 
            : `20${tagName.split('-')[1]}-20${tagName.split('-')[2]} Cross-Year`,
          type,
        },
      });
    }

    // Determine the user's ring in this group:
    // - Primary group → Ring 3 (member)
    // - Cross-year where user is the SENIOR cohort → Ring 2 (auto-elevated)
    // - Cross-year where user is the JUNIOR cohort → Ring 3 (member)
    let groupRing = 3;
    if (!isPrimary && cohortConfig.seniorAutoElevate) {
      // The user is "senior" in a cross-year group if the OTHER year is higher
      // e.g., for cohort-27-28: year 27 is senior, year 28 is junior
      // For crossSeniorName (e.g. cohort-27-28), our year is 28, the senior is 27
      // For crossJuniorName (e.g. cohort-28-29), our year is 28, the junior is 29
      if (tagName === crossJuniorName) {
        // We are the senior in the junior cross-year group
        groupRing = 2;
      }
      // crossSeniorName → we are the junior, remain Ring 3
    }

    // Default permissions for Ring 2 (elevated/seniors)
    const defaultPermissions = groupRing === 2
      ? {
          can_send_messages: true,
          can_delete_own_messages: true,
          can_delete_others_messages: true,
          can_mute_members: true,
          can_kick_members: true,
          can_add_members: true,
          can_tag_members: true,
          can_manage_economy: false,
          can_create_events: false,
          can_pin_messages: true,
          can_manage_roles: false,
          can_edit_group_info: false,
          can_stop_others_tagging: true,
        }
      : {
          can_send_messages: true,
          can_delete_own_messages: true,
          can_delete_others_messages: false,
          can_mute_members: false,
          can_kick_members: false,
          can_add_members: false,
          can_tag_members: true,
          can_manage_economy: false,
          can_create_events: false,
          can_pin_messages: false,
          can_manage_roles: false,
          can_edit_group_info: false,
          can_stop_others_tagging: false,
        };

    // Create group membership (skip if already exists)
    const existingMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: group.id } },
    });

    if (!existingMembership) {
      await prisma.groupMember.create({
        data: {
          userId,
          groupId: group.id,
          ring: groupRing,
          permissions: defaultPermissions,
        },
      });
    }
  }

  // Update the user's cohortTags array
  await prisma.user.update({
    where: { id: userId },
    data: { cohortTags: tags },
  });

  console.log(`[COHORT] ✅ Tagged user ${email}: ${tags.join(', ')}`);
  return tags;
}

/**
 * Re-tag a user: remove their existing cohort memberships and re-apply
 * the current parsing rules. Used after an admin updates the config.
 */
async function retagUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // Remove existing cohort-related group memberships
  await prisma.groupMember.deleteMany({ where: { userId } });

  // Re-assign based on current rules
  return assignCohortTags(userId, user.email);
}

module.exports = { assignCohortTags, retagUser };
