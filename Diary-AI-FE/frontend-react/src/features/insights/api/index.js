// Insights feature API facade
import infra from 'infrastructure/api/insights';

// Feature-level facade for insights. It intentionally re-exports
// commonly used infra methods so feature code can import from
// `features/insights/api` without knowing about infra internals.
export const insightsAPI = {
  getEnhancedComprehensive: (days = 30) => infra.getEnhancedComprehensive(days),
  getComprehensive: (days = 30) => infra.getComprehensive(days),
  // Proxy lower-level endpoints used by the UI
  getPersonalized: (days = 90) => infra.getPersonalized ? infra.getPersonalized(days) : Promise.resolve(null),
  getOptimization: (days = 60, metric = 'energy_level') => infra.getOptimization ? infra.getOptimization(days, metric) : Promise.resolve(null),
};

export default insightsAPI;
