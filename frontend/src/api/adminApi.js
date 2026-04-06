/**
 * Admin API — Institution config, cohort config, user management.
 */

import client from './client';

export const adminApi = {
  // System
  getSystemStatus: () =>
    client.get('/system/status'),

  // Institution
  setupInstitution: (data) =>
    client.post('/admin/institution/setup', data),

  getInstitution: () =>
    client.get('/admin/institution'),

  updateInstitution: (data) =>
    client.patch('/admin/institution', data),

  // Cohort Config
  getCohortConfig: () =>
    client.get('/admin/cohort-config'),

  updateCohortConfig: (data) =>
    client.put('/admin/cohort-config', data),

  previewCohortConfig: (data) =>
    client.post('/admin/cohort-config/preview', data),

  // Users
  listUsers: (params) =>
    client.get('/admin/users', { params }),

  getUser: (id) =>
    client.get(`/admin/users/${id}`),

  setUserRing: (id, ring) =>
    client.patch(`/admin/users/${id}/ring`, { ring }),

  retagUser: (id) =>
    client.post(`/admin/users/${id}/retag`),
};
