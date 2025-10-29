// Health feature API facade
import { healthAPI2 as infraHealth, analyticsAPI } from '../../../infrastructure/api';
import { mapPredictionResultDto } from '../../../entities/health/model';
import { mapCorrelationMatrixDto, mapCorrelationPairsDto } from '../../../entities/health/correlations';
import { mapComprehensiveDto } from '../../../entities/health/comprehensive';
import { mapHealthTrendsDto, mapTemporalPatternsDto } from '../../../entities/health/trends';

export const healthAPI = {
  // Basic data and correlations
  async getStats(){ return infraHealth.getStats(); },
  async getHealthData(days){ return infraHealth.getHealthData(days); },
  async getEnhancedCorrelations(days){ const dto = await infraHealth.getEnhancedCorrelations(days); return { matrix: mapCorrelationMatrixDto(dto?.matrix || dto?.matrix_map || dto?.matrixObj || dto?.matrix || {}), pairs: mapCorrelationPairsDto(dto?.pairs || []) }; },
  async getEnhancedComprehensive(days){ const dto = await infraHealth.getEnhancedComprehensive(days); return mapComprehensiveDto(dto); },
  async getClusterAnalysis(days, clusters){ return infraHealth.getClusterAnalysis(days, clusters); },
  async getTemporalPatterns(days){ const dto = await infraHealth.getTemporalPatterns(days); return mapTemporalPatternsDto(dto); },
  async getRecoveryAnalysis(params){ const dto = await infraHealth.getRecoveryAnalysis(params); const { mapRecoveryAnalysisDto } = await import('../../../entities/health/recovery'); return mapRecoveryAnalysisDto(dto); },

  // Predictions
  async getEnergyPredictions(daysAhead){ return mapPredictionResultDto(await infraHealth.getEnergyPredictions(daysAhead)); },
  async getSleepPredictions(daysAhead){ return mapPredictionResultDto(await infraHealth.getSleepPredictions(daysAhead)); },
  async getMoodPredictions(daysAhead){ return mapPredictionResultDto(await infraHealth.getMoodPredictions(daysAhead)); },
  async getComprehensivePredictions(daysAhead){ return mapPredictionResultDto(await infraHealth.getComprehensivePredictions(daysAhead)); },

  // Trends and insights
  async getHealthTrends(days){ return mapHealthTrendsDto(await infraHealth.getHealthTrends(days)); },
  async getPersonalizedInsights(days){ return infraHealth.getPersonalizedInsights(days); },
  async getOptimizationInsights(days, metric){ return infraHealth.getOptimizationInsights(days, metric); },
  async getSleepAnalysis(days){ return infraHealth.getSleepAnalysis(days); },
  async getStressAnalysis(days){ return infraHealth.getStressAnalysis(days); },
  async getActivityAnalysis(days, options){ const dto = await infraHealth.getActivityAnalysis(days, options); const { mapActivityAnalysisDto } = await import('../../../entities/health/activity'); return mapActivityAnalysisDto(dto); },

  // Weight helpers (thin wrappers exposing infra methods)
  async getCurrentWeight(){ return typeof infraHealth.getCurrentWeight === 'function' ? infraHealth.getCurrentWeight() : null; },
  async getWeightStats(){ return typeof infraHealth.getWeightStats === 'function' ? infraHealth.getWeightStats() : null; },

  // Utilities
  // Utilities
  async comparePeriods(p1, p2, offset){ return infraHealth.comparePeriods(p1, p2, offset); },
};

export { analyticsAPI };
export default healthAPI;
