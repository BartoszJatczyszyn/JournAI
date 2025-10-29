import api from './api';

// healthAPI2: lightweight wrappers around the backend endpoints used by the
// feature modules. Some of these methods used to live in a monolithic
// `api.js`; they're reintroduced here to keep the feature code working.
export const healthAPI2 = {
  // Basic endpoints
  getStats: () => api.get('/api/stats'),
  getHealthData: (days = 30) => api.get(`/api/health-data?days=${days}`),
  getHealthTrends: (days = 90) => api.get(`/api/trends/health?days=${days}`),
  getHealthCheck: () => api.get('/api/health'),

  // Enhanced analytics (used by dashboard/features)
  getEnhancedComprehensive: (days = 90) => api.get(`/api/analytics/enhanced/comprehensive?days=${days}`),
  getEnhancedCorrelations: (days = 90) => api.get(`/api/analytics/enhanced/correlations?days=${days}`),
  getClusterAnalysis: (days = 90, clusters = 3) => api.get(`/api/analytics/enhanced/clusters`, { params: { days, clusters } }),
  getTemporalPatterns: (days = 90) => api.get(`/api/analytics/enhanced/temporal-patterns?days=${days}`),
  getRecoveryAnalysis: (params = {}) => {
    const { days = 90, start_date, end_date, compare } = params || {};
    const search = new URLSearchParams();
    if (start_date && end_date) {
      search.append('start_date', start_date);
      search.append('end_date', end_date);
    } else {
      search.append('days', String(days));
    }
    if (compare) search.append('compare', 'true');
    return api.get(`/api/analytics/enhanced/recovery?${search.toString()}`);
  },

  // Specialized analytics
  getSleepAnalysis: (days = 30, options = {}) => api.get(`/api/analytics/sleep/comprehensive`, { params: { days }, ...options }),
  getStressAnalysis: (days = 30, options = {}) => api.get(`/api/analytics/stress/comprehensive`, { params: { days }, ...options }),
  getActivityAnalysis: (days = 30, options = {}) => api.get(`/api/analytics/activity/comprehensive`, { params: { days }, ...options }),

  // Predictions
  getEnergyPredictions: (daysAhead = 7) => api.get(`/api/predictions/energy?days_ahead=${daysAhead}`),
  getSleepPredictions: (daysAhead = 7) => api.get(`/api/predictions/sleep?days_ahead=${daysAhead}`),
  getMoodPredictions: (daysAhead = 7) => api.get(`/api/predictions/mood?days_ahead=${daysAhead}`),
  getComprehensivePredictions: (daysAhead = 7) => api.get(`/api/predictions/comprehensive?days_ahead=${daysAhead}`),

  // Insights
  getPersonalizedInsights: (days = 90) => api.get(`/api/insights/personalized?days=${days}`),
  getOptimizationInsights: (days = 60, metric = 'energy_level') => api.get(`/api/insights/optimization?days=${days}&metric=${encodeURIComponent(metric)}`),

  // Comparison
  comparePeriods: (period1Days = 30, period2Days = 30, offsetDays = 30) => api.get(`/api/analytics/compare/periods?period1_days=${period1Days}&period2_days=${period2Days}&offset_days=${offsetDays}`),
};

export default healthAPI2;
