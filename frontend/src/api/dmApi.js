/**
 * DM API — Centralized direct-messaging API calls.
 */

import client from './client';

export const dmApi = {
  listConversations: () =>
    client.get('/dm'),

  getMessages: (userId, page = 1, limit = 50) =>
    client.get(`/dm/${userId}?page=${page}&limit=${limit}`),

  sendMessage: (userId, content) =>
    client.post(`/dm/${userId}`, { content }),

  markRead: (userId) =>
    client.patch(`/dm/${userId}/read`),

  deleteMessage: (msgId) =>
    client.delete(`/dm/messages/${msgId}`),
};
