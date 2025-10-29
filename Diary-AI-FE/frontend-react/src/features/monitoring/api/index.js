// Monitoring feature API facade
import infra from 'infrastructure/api/monitoring';

export const monitoringAPI = {
  getHeartRateDaily: (date) => infra.getHeartRateDaily(date),
  getHeartRateSummary: (date) => infra.getHeartRateSummary(date),
  getHeartRateRaw: (date) => infra.getHeartRateRaw(date),
  getStressRaw: (date) => infra.getStressRaw(date),
  getRespiratoryRateRaw: (date) => infra.getRespiratoryRateRaw(date),
  getStressDaily: (date) => infra.getStressDaily(date),
  getStressSummary: (date) => infra.getStressSummary(date),
  getRespiratoryRateDaily: (date) => infra.getRespiratoryRateDaily(date),
  getRespiratoryRateSummary: (date) => infra.getRespiratoryRateSummary(date),
};

export default monitoringAPI;
