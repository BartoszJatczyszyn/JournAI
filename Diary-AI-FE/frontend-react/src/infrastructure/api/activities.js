import api from './api';

export const activitiesAPI = {
  getLatestActivities: (limit = 20) => api.get(`/api/activities/latest?limit=${limit}`),
  getActivityById: (id) => api.get(`/api/activities/${id}`),
};

export default activitiesAPI;
