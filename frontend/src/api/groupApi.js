/**
 * Group API — Centralized group and message API calls.
 */

import client from './client';

export const groupApi = {
  // Groups
  listGroups: () => client.get('/groups'),
  getGroup: (id) => client.get(`/groups/${id}`),
  createGroup: (data) => client.post('/groups', data),
  updateGroup: (id, data) => client.patch(`/groups/${id}`, data),
  deleteGroup: (id) => client.delete(`/groups/${id}`),

  // Members
  listMembers: (groupId) => client.get(`/groups/${groupId}/members`),
  addMember: (groupId, userId) => client.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) => client.delete(`/groups/${groupId}/members/${userId}`),

  // Mute
  muteMember: (groupId, userId, durationMinutes = 60) =>
    client.post(`/groups/${groupId}/members/${userId}/mute`, { durationMinutes }),
  unmuteMember: (groupId, userId) =>
    client.delete(`/groups/${groupId}/members/${userId}/mute`),

  // Ring & Permissions
  getMemberRing: (groupId, userId) => client.get(`/groups/${groupId}/members/${userId}/ring`),
  setMemberRing: (groupId, userId, ring) =>
    client.patch(`/groups/${groupId}/members/${userId}/ring`, { ring }),
  getMemberPermissions: (groupId, userId) =>
    client.get(`/groups/${groupId}/members/${userId}/permissions`),
  setMemberPermissions: (groupId, userId, permissions) =>
    client.patch(`/groups/${groupId}/members/${userId}/permissions`, permissions),

  // Messages
  getMessages: (groupId, page = 1, limit = 50) =>
    client.get(`/groups/${groupId}/messages`, { params: { page, limit } }),
  sendMessage: (groupId, data) =>
    client.post(`/groups/${groupId}/messages`, data),
  editMessage: (groupId, msgId, content) =>
    client.patch(`/groups/${groupId}/messages/${msgId}`, { content }),
  deleteMessage: (groupId, msgId) =>
    client.delete(`/groups/${groupId}/messages/${msgId}`),
  pinMessage: (groupId, msgId) =>
    client.post(`/groups/${groupId}/messages/${msgId}/pin`),
  unpinMessage: (groupId, msgId) =>
    client.delete(`/groups/${groupId}/messages/${msgId}/pin`),
  getPinnedMessages: (groupId) =>
    client.get(`/groups/${groupId}/messages/pinned`),
};
