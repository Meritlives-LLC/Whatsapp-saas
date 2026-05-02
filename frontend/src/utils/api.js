import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (config.headers.set) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    // If 401 and not a refresh/login/auth call, try to refresh
    if (status === 401 &&
        !original._retry &&
        !original.url.includes('/auth/refresh') &&
        !original.url.includes('/auth/login')) {

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          if (original.headers.set) {
            original.headers.set('Authorization', `Bearer ${token}`);
          } else {
            original.headers.Authorization = `Bearer ${token}`;
          }
          return api(original);
        }).catch(e => Promise.reject(e));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = (import.meta.env.VITE_API_URL || '/api') + '/auth/refresh';
        const { data } = await axios.post(refreshUrl, {}, { withCredentials: true });
        const { token } = data;

        localStorage.setItem('token', token);
        
        // Update both defaults and the current failed request
        if (api.defaults.headers.common.set) {
          api.defaults.headers.common.set('Authorization', `Bearer ${token}`);
        } else {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        processQueue(null, token);

        if (original.headers.set) {
          original.headers.set('Authorization', `Bearer ${token}`);
        } else {
          original.headers.Authorization = `Bearer ${token}`;
        }

        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
