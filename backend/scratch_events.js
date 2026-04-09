exports.addOrUpdateOrganizer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, permissions } = req.body;
    
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });
    if (event.creatorId !== req.user.id && req.user.globalRing !== 0) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only creator can manage organizers.' } });
    }

    const org = await prisma.eventOrganizer.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      update: { permissions },
      create: { eventId: id, userId, permissions, ring: 1 }
    });

    return success(res, org);
  } catch (err) { next(err); }
};

exports.verifyTeamParticipation = async (req, res, next) => {
  try {
    const { id: eventId, teamId } = req.params;
    const member = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: req.user.id } }
    });

    if (!member) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a member of this team.' } });

    const updated = await prisma.eventTeamMember.update({
      where: { teamId_userId: { teamId, userId: req.user.id } },
      data: { status: 'verified' }
    });

    return success(res, updated);
  } catch (err) { next(err); }
};

exports.leaveTeam = async (req, res, next) => {
  try {
    const { id: eventId, teamId } = req.params;
    const member = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: req.user.id } }
    });
    
    if (!member) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not in this team.' } });

    const team = await prisma.eventTeam.findUnique({ where: { id: teamId }, include: { members: true } });
    
    if (team.leaderId === req.user.id && team.members.length > 1) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Leader must swap leadership before leaving.' } });
    }

    await prisma.eventTeamMember.delete({
      where: { teamId_userId: { teamId, userId: req.user.id } }
    });

    // Clean up empty team
    if (team.members.length === 1) {
      await prisma.eventTeam.delete({ where: { id: teamId } });
    }

    return success(res, { message: 'Left team successfully.' });
  } catch (err) { next(err); }
};

exports.proposeLeaderSwap = async (req, res, next) => {
  try {
    const { id: eventId, teamId } = req.params;
    const { proposedLeaderId } = req.body;

    const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found.' } });
    if (team.leaderId !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only leader can swap.' } });

    const targetMember = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: proposedLeaderId } }
    });

    if (!targetMember) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Proposed user not a team member.' } });

    const updated = await prisma.eventTeam.update({
      where: { id: teamId },
      data: { proposedLeaderId }
    });

    return success(res, updated);
  } catch (err) { next(err); }
};

exports.acceptLeaderSwap = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
    
    if (team.proposedLeaderId !== req.user.id) {
       return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not the proposed leader.' } });
    }

    const updated = await prisma.eventTeam.update({
      where: { id: teamId },
      data: { leaderId: req.user.id, proposedLeaderId: null }
    });
    
    return success(res, updated);
  } catch (err) { next(err); }
};

exports.rejectLeaderSwap = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
    
    if (team.proposedLeaderId !== req.user.id) {
       return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not the proposed leader.' } });
    }

    const updated = await prisma.eventTeam.update({
      where: { id: teamId },
      data: { proposedLeaderId: null }
    });
    
    return success(res, updated);
  } catch (err) { next(err); }
};

exports.createTask = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const { 
      title, description, order, basePoints, submissionType, submissionConfig, 
      isAutoEvaluated, isDynamicScore, decayPercentage, wrongSubmissionPenalty 
    } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organizers: true } });
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });

    const isOrganizer = event.creatorId === req.user.id || event.organizers.some(o => o.userId === req.user.id);
    if (!isOrganizer && req.user.globalRing !== 0) return res.status(403).json({ error: { code: 'FORBIDDEN' } });

    const task = await prisma.eventTask.create({
      data: {
        eventId, title, description, order, basePoints: basePoints || 100, 
        submissionType: submissionType || 'text',
        submissionConfig, isAutoEvaluated: isAutoEvaluated || false,
        isDynamicScore: isDynamicScore || false,
        decayPercentage: decayPercentage || 0,
        wrongSubmissionPenalty: wrongSubmissionPenalty || 0
      }
    });
    return success(res, task, 201);
  } catch (err) { next(err); }
};

exports.listTasks = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organizers: true } });
    
    const isOrganizer = event.creatorId === req.user.id || event.organizers.some(o => o.userId === req.user.id) || req.user.globalRing === 0;

    let tasks = await prisma.eventTask.findMany({
      where: { eventId },
      orderBy: { order: 'asc' }
    });

    if (!isOrganizer && event.taskViewMode === 'dynamic') {
      // Find max completed task order for the user's team
      const teamMember = await prisma.eventTeamMember.findFirst({
        where: { userId: req.user.id, team: { eventId } },
        include: { team: { include: { submissions: { where: { status: 'correct' }, include: { task: true } } } } }
      });

      if (teamMember) {
        let maxOrder = 0;
        teamMember.team.submissions.forEach(sub => {
          if (sub.task.order > maxOrder) maxOrder = sub.task.order;
        });
        
        // Show up to the next task
        tasks = tasks.filter(t => t.order <= maxOrder + 1);
      } else {
        // Not in team, show only first task or none
        tasks = tasks.filter(t => t.order === 1);
      }
    }

    return success(res, tasks);
  } catch (err) { next(err); }
};

exports.submitTask = async (req, res, next) => {
  try {
    const { id: eventId, taskId } = req.params;
    const { content } = req.body;

    const task = await prisma.eventTask.findUnique({ where: { id: taskId, eventId } });
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found.' } });

    const member = await prisma.eventTeamMember.findFirst({
      where: { userId: req.user.id, team: { eventId } },
      include: { team: true }
    });

    if (!member) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not in a team.' } });

    // Ensure they haven't already solved it
    const existingCorrect = await prisma.eventSubmission.findFirst({
      where: { teamId: member.teamId, taskId, status: 'correct' }
    });

    if (existingCorrect) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Already solved.' } });

    let status = 'pending';
    let scoreAwarded = 0;

    if (task.isAutoEvaluated && task.submissionConfig) {
       // Simplistic text auto eval for now
       if (task.submissionType === 'text') {
         if (content.text && task.submissionConfig.exactText && content.text.trim() === task.submissionConfig.exactText) {
             status = 'correct';
         } else {
             status = 'wrong';
         }
       }
    }

    if (status === 'correct') {
       scoreAwarded = task.basePoints;
       // We'll apply dynamic scoring and penalties on the leaderboard endpoint for simplicity of recalculations,
       // or we deduct here. Let's award basePoints here and compute penalty dynamically.
    }

    const sub = await prisma.eventSubmission.create({
      data: {
        eventId,
        teamId: member.teamId,
        taskId,
        content,
        status,
        scoreAwarded
      }
    });

    return success(res, sub, 201);
  } catch (err) { next(err); }
};

exports.listSubmissions = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const subs = await prisma.eventSubmission.findMany({
      where: { taskId },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' }
    });
    return success(res, subs);
  } catch(err) { next(err); }
};

exports.evaluateSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { status, scoreAwarded } = req.body;

    const sub = await prisma.eventSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        scoreAwarded: scoreAwarded || 0,
        evaluatedById: req.user.id,
        evaluatedAt: new Date()
      }
    });
    
    return success(res, sub);
  } catch(err) { next(err); }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

    const teams = await prisma.eventTeam.findMany({
      where: { eventId },
      include: {
        submissions: { include: { task: true } }
      }
    });

    const leaderboard = teams.map(team => {
       let totalScore = team.points; // Base points if manual awarding was used
       team.submissions.forEach(sub => {
         if (sub.status === 'correct') {
            let taskScore = sub.scoreAwarded;
            if (sub.task.isDynamicScore) {
               const elapsedMinutes = (new Date(sub.submittedAt).getTime() - new Date(event.startDate).getTime()) / 60000;
               if (elapsedMinutes > 0) {
                 const penalty = sub.task.basePoints * (sub.task.decayPercentage / 100) * elapsedMinutes;
                 taskScore = Math.max(sub.task.basePoints * 0.1, sub.task.basePoints - penalty); // floor at 10%
               }
            }
            totalScore += taskScore;
         } else if (sub.status === 'wrong') {
             // deduct penalty
             totalScore -= sub.task.wrongSubmissionPenalty;
             // Global penalty if exists
             totalScore -= event.wrongSubmissionPenalty;
         }
       });

       return { id: team.id, name: team.name, score: Math.round(totalScore) };
    });

    leaderboard.sort((a, b) => b.score - a.score);

    return success(res, leaderboard);
  } catch(err) { next(err); }
};
