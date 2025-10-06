import api from './api';

export const monitoringAPI = {
  // Heart rate endpoints
  getHeartRateDaily: (date) => api.get(`/api/heart-rate/daily/${date}`),
  getHeartRateSummary: (date) => api.get(`/api/heart-rate/summary/${date}`),
  // Raw minute-level heart rate rows (from garmin_heart_rate_data)
  getHeartRateRaw: (date) => api.get(`/api/heart-rate/raw/${date}`),
  // Raw minute-level stress rows
  getStressRaw: (date) => api.get(`/api/stress/raw/${date}`),
  // Raw minute-level respiratory rate rows
  getRespiratoryRateRaw: (date) => api.get(`/api/respiratory-rate/raw/${date}`),

  // Stress endpoints
  getStressDaily: (date) => api.get(`/api/stress/daily/${date}`),
  getStressSummary: (date) => api.get(`/api/stress/summary/${date}`),

  // Respiratory rate endpoints
  getRespiratoryRateDaily: (date) => api.get(`/api/respiratory-rate/daily/${date}`),
  getRespiratoryRateSummary: (date) => api.get(`/api/respiratory-rate/summary/${date}`),
};

export default monitoringAPI;
