/**
 * User API — Profile and user-related API calls.
 */

import client from './client';

export const userApi = {
  getProfile: () =>
    client.get('/users/me'),

  updateProfile: (data) =>
    client.patch('/users/me', data),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return client.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getTags: () =>
    client.get('/users/me/tags'),

  searchUsers: (query) =>
    client.get(`/admin/users?search=${encodeURIComponent(query)}&limit=10`),
};
