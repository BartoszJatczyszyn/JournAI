import api from './api';

export const predictionsAPI = {
  getEnergy: (daysAhead = 7) => api.get(`/api/predictions/energy?days_ahead=${daysAhead}`),
  getSleep: (daysAhead = 7) => api.get(`/api/predictions/sleep?days_ahead=${daysAhead}`),
  getMood: (daysAhead = 7) => api.get(`/api/predictions/mood?days_ahead=${daysAhead}`),
  getComprehensive: (daysAhead = 7) => api.get(`/api/predictions/comprehensive?days_ahead=${daysAhead}`),
};

export default predictionsAPI;
