/**
 * Auth API — Centralized auth API calls.
 */

import client from './client';

export const authApi = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  register: (email, password, displayName) =>
    client.post('/auth/register', { email, password, displayName }),

  logout: () =>
    client.post('/auth/logout'),

  refreshToken: (refreshToken) =>
    client.post('/auth/refresh', { refreshToken }),

  forgotPassword: (email) =>
    client.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    client.post('/auth/reset-password', { token, newPassword }),
};
