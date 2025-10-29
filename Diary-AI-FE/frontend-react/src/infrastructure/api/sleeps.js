import api from './api';

export const sleepsAPI = {
  getLatestSleeps: ({ limit = 20, page = 1, startDate, endDate } = {}) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    const offset = (Math.max(1, page) - 1) * limit;
    if (offset) params.append('offset', String(offset));
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return api.get(`/api/sleeps/latest?${params.toString()}`);
  },
  getSleepById: (id) => api.get(`/api/sleeps/${id}`),
  getSleepEvents: (date) => api.get(`/api/sleep/events/${date}`),
  // Create a sleep session (best-effort: backend may not expose this endpoint yet)
  createSleep: (payload) => api.post(`/api/sleeps`, payload),
  updateSleep: (id, payload) => api.put(`/api/sleeps/${id}`, payload),
  deleteSleep: (id) => api.delete(`/api/sleeps/${id}`),
};

export default sleepsAPI;
