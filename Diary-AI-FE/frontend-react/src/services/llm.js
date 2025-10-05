import api from './api';

const llm = {
  health: () => api.get('/api/llm/health'),
  getHealthReport: (days = 30, language = 'pl') => api.get(`/api/llm/health-report?days=${days}&language=${encodeURIComponent(language)}`),
  chat: ({ messages, temperature = 0.3, max_tokens = 512, top_p = 0.95 }) =>
    api.post('/api/llm/chat', { messages, temperature, max_tokens, top_p }),
  getLatestStored: (language) => api.get(`/api/llm/reports/latest${language ? `?language=${encodeURIComponent(language)}` : ''}`),
  generateNow: (days = 30, language = 'pl') => api.post(`/api/llm/reports/generate?days=${days}&language=${encodeURIComponent(language)}`),
  getHistory: (limit = 10, language) => api.get(`/api/llm/reports/history?limit=${limit}${language ? `&language=${encodeURIComponent(language)}` : ''}`),
};

export default llm;
