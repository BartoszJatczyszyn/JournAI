import api from './api';

export const analyticsAPI = {
  getEnhancedComprehensive: (days = 90) =>
    api.get(`/api/analytics/enhanced/comprehensive?days=${days}`),

  getEnhancedCorrelations: (days = 90) =>
    api.get(`/api/analytics/enhanced/correlations?days=${days}`),

  getClusterAnalysis: (days = 90, clusters = 3) =>
    api.get(`/api/analytics/enhanced/clusters`, { params: { days, clusters } }),

  getTemporalPatterns: (days = 90) =>
    api.get(`/api/analytics/enhanced/temporal-patterns?days=${days}`),

  getRecoveryAnalysis: ({ days = 90, start_date, end_date, compare } = {}) => {
    const params = new URLSearchParams();
    if (start_date && end_date) {
      params.append('start_date', start_date);
      params.append('end_date', end_date);
    } else {
      params.append('days', String(days));
    }
    if (compare) params.append('compare', 'true');
    return api.get(`/api/analytics/enhanced/recovery?${params.toString()}`);
  },

  getSleepAnalysis: (days = 30, options = {}) =>
    api.get(`/api/analytics/sleep/comprehensive`, { params: { days }, ...options }),

  getStressAnalysis: (days = 30, options = {}) =>
    api.get(`/api/analytics/stress/comprehensive`, { params: { days }, ...options }),

  getActivityAnalysis: (days = 30, options = {}) =>
    api.get(`/api/analytics/activity/comprehensive`, { params: { days }, ...options }),

  getLegacyCorrelations: () => api.get('/api/analytics/correlations'),
  comparePeriods: (period1Days = 30, period2Days = 30, offsetDays = 30) =>
    api.get(`/api/analytics/compare/periods?period1_days=${period1Days}&period2_days=${period2Days}&offset_days=${offsetDays}`),
};

export default analyticsAPI;
