import { api } from './api';

export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  registrationDepartments: (payload) => api.post('/auth/registration-departments', payload),
  requestPasswordReset: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  login: (payload) => api.post('/auth/login', payload),
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};
