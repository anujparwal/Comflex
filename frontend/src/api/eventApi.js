import client from './client';

export const eventApi = {
  listEvents: () => client.get('/events'),
  listManagedEvents: () => client.get('/events/manage'),
  getEvent: (id) => client.get(`/events/${id}`),
  createEvent: (data) => client.post('/events', data),
  updateEvent: (id, data) => client.patch(`/events/${id}`, data),
  deleteEvent: (id) => client.delete(`/events/${id}`),
  createTeam: (eventId, name) => client.post(`/events/${eventId}/teams`, { name }),
  listTeams: (eventId) => client.get(`/events/${eventId}/teams`),
  inviteToTeam: (eventId, teamId, userId) => client.post(`/events/${eventId}/teams/${teamId}/invites`, { userId }),
  acceptTeamInvite: (eventId, inviteId) => client.post(`/events/${eventId}/teams/invites/${inviteId}/accept`),
  rejectTeamInvite: (eventId, inviteId) => client.post(`/events/${eventId}/teams/invites/${inviteId}/reject`),
  addOrganizer: (eventId, data) => client.post(`/events/${eventId}/organizers`, data),
  getLeaderboard: (eventId) => client.get(`/events/${eventId}/leaderboard`),
};
