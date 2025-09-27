import api from './api';

export const healthAPI2 = {
  getStats: () => api.get('/api/stats'),
  getHealthData: (days = 30) => api.get(`/api/health-data?days=${days}`),
  getHealthTrends: (days = 90) => api.get(`/api/trends/health?days=${days}`),
  getHealthCheck: () => api.get('/api/health'),
};

export default healthAPI2;
