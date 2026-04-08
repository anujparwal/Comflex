const { PrismaClient } = require('@prisma/client');
const { success } = require('../utils/apiResponse');
const prisma = new PrismaClient();

exports.listEvents = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    // Find events matching user targeting tags or public events (empty targetTags)
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { targetTags: { isEmpty: true } },
          { targetTags: { hasSome: user.cohortTags || [] } }
        ],
        // Optionally filter by status based on business logic, here we fetch all for debugging
      },
      include: {
        subEvents: true,
        creator: {
          select: { id: true, displayName: true, avatarUrl: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    return success(res, events);
  } catch (err) {
    next(err);
  }
};

exports.listManagedEvents = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    let events = [];
    if (user.globalRing === 0) {
      events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } else {
      events = await prisma.event.findMany({
        where: {
          OR: [
            { creatorId: user.id },
            { organizers: { some: { userId: user.id } } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    return success(res, events);
  } catch (err) {
    next(err);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        subEvents: true,
        organizers: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, globalRing: true } }
          }
        }
      }
    });

    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });

    return success(res, event);
  } catch (err) {
    next(err);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const {
      title, description, startDate, endDate, category, targetTags,
      parentId, keepTeamsSame, isTeamEvent, minTeamSize, maxTeamSize, status
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Ensure the user has the right to create an event at the platform level
    // Wait, let's treat admin (globalRing 0) or user.canCreateEvents as autorized.
    if (user.globalRing > 1 && !user.canCreateEvents && !parentId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to create main events.' } });
    }

    // If it's a subevent, check if user is an organizer of the parent event
    if (parentId) {
      const parent = await prisma.event.findUnique({
        where: { id: parentId },
        include: { organizers: true }
      });
      if (!parent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Parent event not found.' } });
      
      const isOrganizer = parent.creatorId === user.id || parent.organizers.some(o => o.userId === user.id);
      if (!isOrganizer && user.globalRing !== 0) {
         return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to add sub-events.' } });
      }
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        startDate,
        endDate,
        category,
        targetTags: targetTags || [],
        parentId,
        keepTeamsSame: keepTeamsSame || false,
        isTeamEvent: isTeamEvent || false,
        minTeamSize: minTeamSize || 1,
        maxTeamSize: maxTeamSize || 1,
        status: status || 'draft',
        creatorId: user.id
      }
    });

    // Automatically make creator an organizer
    await prisma.eventOrganizer.create({
      data: {
        eventId: event.id,
        userId: user.id,
        ring: 0,
        permissions: { canEditDetails: true, canCreateSubevents: true, canManageTeams: true, canAwardPoints: true, canManageRoles: true }
      }
    });

    // Phase migration logic for kept teams
    if (parentId && keepTeamsSame) {
      const parentTeams = await prisma.eventTeam.findMany({
        where: { eventId: parentId, status: 'qualified_for_next_phase' },
        include: { members: true }
      });
      
      for (const team of parentTeams) {
        const newTeam = await prisma.eventTeam.create({
          data: {
            eventId: event.id,
            name: team.name,
            leaderId: team.leaderId,
            status: 'registered'
          }
        });
        
        await prisma.eventTeamMember.createMany({
          data: team.members.map(m => ({
            teamId: newTeam.id,
            userId: m.userId
          }))
        });
      }
    }

    return success(res, event, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { organizers: true }
    });

    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isOrganizer = event.creatorId === user.id || event.organizers.some(o => o.userId === user.id);
    
    if (!isOrganizer && user.globalRing !== 0) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized.' } });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updateData
    });

    return success(res, updatedEvent);
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: { organizers: true }
    });

    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isOrganizer = event.creatorId === user.id || event.organizers.some(o => o.userId === user.id);

    if (!isOrganizer && user.globalRing !== 0) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized.' } });
    }

    await prisma.event.delete({ where: { id } });

    return success(res, { message: 'Event deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.createTeam = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const { name } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });

    // Check if user is already in a team for this event
    const existingTeam = await prisma.eventTeamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { eventId }
      }
    });

    if (existingTeam) {
      return res.status(400).json({ error: { code: 'CONFLICT', message: 'You are already in a team for this event.' } });
    }

    const team = await prisma.eventTeam.create({
      data: {
        eventId,
        name,
        leaderId: req.user.id,
        status: 'registered'
      }
    });

    await prisma.eventTeamMember.create({
      data: {
        teamId: team.id,
        userId: req.user.id
      }
    });

    return success(res, team, 201);
  } catch (err) {
    next(err);
  }
};

exports.listTeams = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const teams = await prisma.eventTeam.findMany({
      where: { eventId },
      include: {
        leader: { select: { id: true, displayName: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } }
          }
        }
      }
    });

    return success(res, teams);
  } catch (err) {
    next(err);
  }
};

exports.inviteToTeam = async (req, res, next) => {
  try {
    const { id: eventId, teamId } = req.params;
    const { userId } = req.body;

    const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found.' } });

    if (team.leaderId !== req.user.id) {
       return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only team leader can invite.' } });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const membersCount = await prisma.eventTeamMember.count({ where: { teamId } });

    if (membersCount >= event.maxTeamSize) {
      return res.status(400).json({ error: { code: 'CONFLICT', message: 'Team is full.' } });
    }

    const existingInvite = await prisma.eventTeamInvite.findUnique({
      where: { teamId_invitedUserId: { teamId, invitedUserId: userId } }
    });

    if (existingInvite) {
      return res.status(400).json({ error: { code: 'CONFLICT', message: 'Invite already sent.' } });
    }

    const invite = await prisma.eventTeamInvite.create({
      data: {
        teamId,
        eventId,
        invitedUserId: userId,
        invitedBy: req.user.id,
      }
    });

    return success(res, invite, 201);
  } catch (err) {
    next(err);
  }
};

exports.acceptTeamInvite = async (req, res, next) => {
  try {
    const { id: eventId, inviteId } = req.params;

    const invite = await prisma.eventTeamInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found.' } });

    if (invite.invitedUserId !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized.' } });
    }

    // Check if user is already in a team
    const existingTeam = await prisma.eventTeamMember.findFirst({
      where: {
        userId: req.user.id,
        team: { eventId }
      }
    });

    if (existingTeam) {
      return res.status(400).json({ error: { code: 'CONFLICT', message: 'You are already in a team.' } });
    }

    await prisma.eventTeamMember.create({
      data: { teamId: invite.teamId, userId: req.user.id }
    });

    await prisma.eventTeamInvite.update({
      where: { id: inviteId },
      data: { status: 'accepted' }
    });

    return success(res, { message: 'Invite accepted.' });
  } catch (err) {
    next(err);
  }
};

exports.rejectTeamInvite = async (req, res, next) => {
  try {
    const { inviteId } = req.params;

    const invite = await prisma.eventTeamInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found.' } });

    if (invite.invitedUserId !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized.' } });
    }

    await prisma.eventTeamInvite.update({
      where: { id: inviteId },
      data: { status: 'rejected' }
    });

    return success(res, { message: 'Invite rejected.' });
  } catch (err) {
    next(err);
  }
};
