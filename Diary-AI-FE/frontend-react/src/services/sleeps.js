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
};

export default sleepsAPI;
