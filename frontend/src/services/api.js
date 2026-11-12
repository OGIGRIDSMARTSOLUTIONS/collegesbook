import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Keep refresh separate to prevent interceptor recursion. Share concurrent refreshes.
const refreshApi = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

// Bypasses silent refresh for sensitive administrator route verification.
export const strictAuthApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
let pendingRefresh = null;

function refreshSession() {
  if (!pendingRefresh) {
    pendingRefresh = refreshApi.post('/auth/refresh').finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

api.interceptors.response.use(
  (response) => response.data?.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || '';
    const noRefresh = [
      '/auth/login', '/auth/register', '/auth/google', '/auth/logout',
      '/auth/refresh', '/auth/forgot-password', '/auth/reset-password',
    ];
    const excluded = noRefresh.some((path) => url === path || url.startsWith(`${path}?`));

    if (status === 401 && original && !original._retried && !excluded) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        // No refresh session: let the caller handle the unauthenticated state.
      }
    }

    return Promise.reject({
      status,
      message: error.response?.data?.message || error.message,
      details: error.response?.data?.details,
    });
  }
);

// Keep the error shape consistent with the regular API client.
strictAuthApi.interceptors.response.use(
  (response) => response.data?.data,
  (error) => Promise.reject({
    status: error.response?.status,
    message: error.response?.data?.message || error.message,
  })
);
