import api from './api';

export const journalAPI = {
  getEntry: (date) => api.get(`/api/journal/${date}`),
  updateEntry: (date, data) => api.put(`/api/journal/${date}`, data),
};

export default journalAPI;
