// Central hooks barrel — re-export feature-scoped hook implementations.
// Keep both named and default re-exports where the feature files export both to preserve compatibility.

export { useActivityAggregates } from 'features/activities/hooks/useActivityAggregates';
export { useActivityPredictions } from 'features/activities/hooks/useActivityPredictions';
export { useGoalSimulation } from 'features/activities/hooks/useGoalSimulation';

export { default as useStrengthBackend } from 'features/strength/hooks/useStrengthBackend';

export { useSleepAnalysis } from 'features/sleep/hooks/useSleepAnalysis';

export { default as useCurrentWeight } from 'features/health/hooks/useCurrentWeight';

export { useJournalContext } from 'features/journal/hooks/useJournalContext';
export { useJournalSync } from 'features/journal/hooks/useJournalSync';

// Add more re-exports here as hooks migrate to feature folders.
