import api from './api';

export const insightsAPI = {
  getPersonalized: (days = 90) => api.get(`/api/insights/personalized?days=${days}`),
  getOptimization: (days = 60, metric = 'energy_level') =>
    api.get(`/api/insights/optimization?days=${days}&metric=${metric}`),
};

export default insightsAPI;
