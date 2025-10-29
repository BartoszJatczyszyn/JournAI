import axios from 'axios';

// Create axios instance with base configuration
export const API_BASE_URL = (function() {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  // When running via CRA dev server with a proxy, using relative base URL works best
  return '';
})();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response.data;
  },
  (error) => {
    // Log the full error object for easier debugging (status, headers, body)
    console.error('API Response Error:', error);

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      // Log response details (helps with 4xx/5xx investigation)
      try {
        console.error('API Response details:', { status, data });
      } catch (e) {
        console.error('Failed to stringify response details', e);
      }

      // Handle structured error responses from backend
      if (data && typeof data === 'object') {
        const message = data.error || data.message || `HTTP ${status} Error`;
        const err = new Error(message);
        err.status = status;
        err.data = data;
        throw err;
      }

      const err = new Error(`HTTP ${status} Error`);
      err.status = status;
      throw err;
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network error - please check your connection');
    } else {
      // Something else happened
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
);

// Deprecated monolith (use domain modules). Kept for backward compatibility.
export const healthAPI = {
  // Basic endpoints
  getStats: () => api.get('/api/stats'),
  getHealthData: (days = 30) => api.get(`/api/health-data?days=${days}`), // expects [{day, steps, calories, rhr, stress_avg, sleep_score, time_in_bed_minutes, mood, energy}]
  getCorrelations: () => api.get('/api/analytics/enhanced/correlations?days=30'),
  
  // Enhanced Analytics endpoints
  getEnhancedComprehensive: (days = 90) => 
    api.get(`/api/analytics/enhanced/comprehensive?days=${days}`),
  
  getEnhancedCorrelations: (days = 90) => 
    api.get(`/api/analytics/enhanced/correlations?days=${days}`),
  
  getClusterAnalysis: (days = 90, clusters = 3) => 
    api.get(`/api/analytics/enhanced/clusters`, {
      params: { days, clusters }
    }),
  
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
  
  // Activities endpoints
  getLatestActivities: (limit = 20) => api.get(`/api/activities/latest?limit=${limit}`),
  getActivityById: (id) => api.get(`/api/activities/${id}`),

  // Sleeps endpoints
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
  
  // Specialized Analytics endpoints with proper parameter handling
  getSleepAnalysis: (days = 30, options = {}) => {
    // Ensure days is a number between 1 and 365
    const daysNum = Math.min(Math.max(1, parseInt(days, 10) || 30), 365);

    console.log(`Fetching sleep analysis (specialized) for ${daysNum} days`);

    return api.get(`/api/analytics/sleep/comprehensive`, {
      params: { days: daysNum },
      timeout: 30000,
      ...options,
    });
  },
  
  getStressAnalysis: (days = 30, options = {}) => 
    api.get(`/api/analytics/stress/comprehensive`, { 
      params: { days },
      ...options
    }),
  
  getActivityAnalysis: (days = 30, options = {}) => 
    api.get(`/api/analytics/activity/comprehensive`, { 
      params: { days },
      ...options
    }),
  
  // Predictive Analytics endpoints
  getEnergyPredictions: (daysAhead = 7) => 
    api.get(`/api/predictions/energy?days_ahead=${daysAhead}`),
  
  getSleepPredictions: (daysAhead = 7) => 
    api.get(`/api/predictions/sleep?days_ahead=${daysAhead}`),
  
  getMoodPredictions: (daysAhead = 7) => 
    api.get(`/api/predictions/mood?days_ahead=${daysAhead}`),
  
  getComprehensivePredictions: (daysAhead = 7) => 
    api.get(`/api/predictions/comprehensive?days_ahead=${daysAhead}`),
  
  getHealthTrends: (days = 90) => 
    api.get(`/api/trends/health?days=${days}`),
  
  // Insights endpoints
  getPersonalizedInsights: (days = 90) => 
    api.get(`/api/insights/personalized?days=${days}`),
  
  getOptimizationInsights: (days = 60, metric = 'energy_level') => 
    api.get(`/api/insights/optimization?days=${days}&metric=${metric}`),
  
  // Comparison endpoints
  comparePeriods: (period1Days = 30, period2Days = 30, offsetDays = 30) => 
    api.get(`/api/analytics/compare/periods?period1_days=${period1Days}&period2_days=${period2Days}&offset_days=${offsetDays}`),
  
  // Monitoring endpoints (from v3 API)
  getHeartRateDaily: (date) => 
    api.get(`/api/heart-rate/daily/${date}`),
  
  getHeartRateSummary: (date) => 
    api.get(`/api/heart-rate/summary/${date}`),
  
  getHeartRateTrend: (days = 30) => 
    api.get(`/api/heart-rate/trend?days=${days}`),
  
  getStressDaily: (date) => 
    api.get(`/api/stress/daily/${date}`),
  
  getStressSummary: (date) => 
    api.get(`/api/stress/summary/${date}`),
  
  getStressTrend: (days = 30) => 
    api.get(`/api/stress/trend?days=${days}`),
  
  getRespiratoryRateDaily: (date) => 
    api.get(`/api/respiratory-rate/daily/${date}`),
  
  getRespiratoryRateSummary: (date) => 
    api.get(`/api/respiratory-rate/summary/${date}`),
  
  getRespiratoryRateTrend: (days = 30) => 
    api.get(`/api/respiratory-rate/trend?days=${days}`),
  
  getWeightHistory: (days = 90) => 
    api.get(`/api/weight/history?days=${days}`),
  
  getWeightStats: () => 
    api.get('/api/weight/stats'),

  getCurrentWeight: () => 
    api.get('/api/weight/current'),
  
  getSleepEvents: (date) => 
    api.get(`/api/sleep/events/${date}`),
  
  getSleepTrend: (days = 30) => 
    api.get(`/api/sleep-trend?days=${days}`),
  
  getWeightTrend: (days = 90) => 
    api.get(`/api/weight-trend?days=${days}`),
  
  getMoodDistribution: () => 
    api.get('/api/mood-distribution'),
  
  // Journal endpoints
  getJournalEntry: (date) => 
    api.get(`/api/journal/${date}`),
  
  updateJournalEntry: (date, data) => 
    api.put(`/api/journal/${date}`, data),
  
  // Export endpoints
  exportData: (type = 'summary', days = 30) => 
    api.get(`/api/export?type=${type}&days=${days}`),
  
  // System endpoints
  getAnalyticsInfo: () => 
    api.get('/api/analytics/info'),
  
  getHealthCheck: () => 
    api.get('/api/health'),
};

// Utility functions
export const formatApiError = (error) => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const isApiAvailable = async () => {
  try {
    await healthAPI.getHealthCheck();
    return true;
  } catch (error) {
    console.error('API not available:', error);
    return false;
  }
};

// Data transformation utilities
export const transformHealthData = (data) => {
  if (!data || !Array.isArray(data)) return [];
  
  return data.map(item => ({
    ...item,
    date: new Date(item.day || item.date),
    // Ensure numeric values
    steps: Number(item.steps) || 0,
    calories: Number(item.calories_total) || 0,
    rhr: Number(item.rhr) || 0,
    sleepScore: Number(item.sleep_score) || 0,
    mood: Number(item.mood) || 0,
    energy: Number(item.energy_level) || 0,
  }));
};

export const transformCorrelationData = (correlations) => {
  if (!correlations || typeof correlations !== 'object') return [];
  
  const result = [];
  Object.keys(correlations).forEach(field1 => {
    Object.keys(correlations[field1]).forEach(field2 => {
      if (field1 !== field2 && correlations[field1][field2] !== null) {
        result.push({
          field1,
          field2,
          correlation: correlations[field1][field2],
          strength: Math.abs(correlations[field1][field2]) > 0.7 ? 'strong' :
                   Math.abs(correlations[field1][field2]) > 0.5 ? 'moderate' :
                   Math.abs(correlations[field1][field2]) > 0.3 ? 'weak' : 'negligible'
        });
      }
    });
  });
  
  return result.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
};

export const transformPredictionData = (predictions) => {
  if (!predictions || !Array.isArray(predictions)) return [];
  
  return predictions.map(pred => ({
    ...pred,
    date: new Date(pred.date),
    value: Number(pred.predicted_value) || 0,
    confidence: Number(pred.confidence) || 0,
  }));
};

// Chart color utilities
export const getChartColors = (darkMode = false) => ({
  primary: darkMode ? '#60a5fa' : '#3b82f6',
  secondary: darkMode ? '#34d399' : '#10b981',
  accent: darkMode ? '#fbbf24' : '#f59e0b',
  danger: darkMode ? '#f87171' : '#ef4444',
  warning: darkMode ? '#fcd34d' : '#f59e0b',
  success: darkMode ? '#4ade80' : '#22c55e',
  text: darkMode ? '#f1f5f9' : '#1e293b',
  grid: darkMode ? '#374151' : '#e2e8f0',
  background: darkMode ? '#1e293b' : '#ffffff',
});

export default api;