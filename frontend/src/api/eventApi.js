import client from './client';

export const eventApi = {
  listEvents: () => client.get('/api/v1/events'),
  listManagedEvents: () => client.get('/api/v1/events/manage'),
  getEvent: (id) => client.get(`/api/v1/events/${id}`),
  createEvent: (data) => client.post('/api/v1/events', data),
  updateEvent: (id, data) => client.patch(`/api/v1/events/${id}`, data),
  deleteEvent: (id) => client.delete(`/api/v1/events/${id}`),
  createTeam: (eventId, name) => client.post(`/api/v1/events/${eventId}/teams`, { name }),
  listTeams: (eventId) => client.get(`/api/v1/events/${eventId}/teams`),
  inviteToTeam: (eventId, teamId, userId) => client.post(`/api/v1/events/${eventId}/teams/${teamId}/invites`, { userId }),
  acceptTeamInvite: (eventId, inviteId) => client.post(`/api/v1/events/${eventId}/teams/invites/${inviteId}/accept`),
  rejectTeamInvite: (eventId, inviteId) => client.post(`/api/v1/events/${eventId}/teams/invites/${inviteId}/reject`),
};
