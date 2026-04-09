/**
 * Group API — Centralized group, message, invite, and read receipt API calls.
 */

import client from './client';

export const groupApi = {
  // Groups
  listGroups: () => client.get('/groups'),
  getGroup: (id) => client.get(`/groups/${id}`),
  createGroup: (data) => client.post('/groups', data),
  updateGroup: (id, data) => client.patch(`/groups/${id}`, data),
  deleteGroup: (id) => client.delete(`/groups/${id}`),

  // Group Avatar
  uploadGroupAvatar: (groupId, file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return client.post(`/groups/${groupId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Members
  listMembers: (groupId) => client.get(`/groups/${groupId}/members`),
  addMember: (groupId, userId) => client.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) => client.delete(`/groups/${groupId}/members/${userId}`),

  // Invites
  listGroupInvites: (groupId) => client.get(`/groups/${groupId}/invites`),
  listMyInvites: () => client.get('/groups/invites'),
  createGroupInvite: (groupId, userId) => client.post(`/groups/${groupId}/invites`, { userId }),
  acceptInvite: (groupId, inviteId) => client.post(`/groups/${groupId}/invites/${inviteId}/accept`),
  rejectInvite: (groupId, inviteId) => client.post(`/groups/${groupId}/invites/${inviteId}/reject`),
  getInviteLink: (groupId) => client.get(`/groups/${groupId}/invite-link`),

  // User search for invites
  searchUsersForGroup: (groupId, query) =>
    client.get(`/groups/${groupId}/search-users`, { params: { q: query } }),

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
  sendMessage: (groupId, data) => {
    if (data instanceof FormData) {
      return client.post(`/groups/${groupId}/messages`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return client.post(`/groups/${groupId}/messages`, data);
  },
  reactToMessage: (groupId, msgId, emoji) =>
    client.patch(`/groups/${groupId}/messages/${msgId}/react`, { emoji }),
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

  // Read Receipts
  markMessagesRead: (groupId) =>
    client.post(`/groups/${groupId}/messages/read`),
  getMessageReadBy: (groupId, msgId) =>
    client.get(`/groups/${groupId}/messages/${msgId}/readby`),
  getUnreadCount: (groupId) =>
    client.get(`/groups/${groupId}/unread`),

  // Leave & Delete
  leaveGroup: (groupId) => client.delete(`/groups/${groupId}/leave`),
  deleteGroup: (groupId) => client.delete(`/groups/${groupId}`),

  // Ring Configuration
  updateRingConfig: (groupId, config) =>
    client.patch(`/groups/${groupId}/rings`, config),
};
