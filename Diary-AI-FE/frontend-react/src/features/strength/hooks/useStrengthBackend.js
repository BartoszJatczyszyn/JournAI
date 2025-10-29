import { useEffect, useMemo, useState } from 'react';
import { listWorkouts, getWorkout, deleteWorkout, listTemplates, upsertTemplate, deleteTemplate as apiDeleteTemplate } from 'features/strength/api';

// Simple helper to sum tonnage
function calcTonnage(workout) {
  let tonnage = 0;
  (workout.exercises || workout.exercise_logs || []).forEach((ex) => {
    (ex.sets || ex.exercise_sets || []).forEach((s) => {
      const w = s.weight ?? s.weight_kg ?? 0;
      const r = s.reps ?? s.repetitions ?? 0;
      if (w && r) tonnage += w * r;
    });
  });
  return tonnage;
}

export default function useStrengthBackend({ initialLimit = 100 } = {}) {
  const [workouts, setWorkouts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [errorWorkouts, setErrorWorkouts] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [errorTemplates, setErrorTemplates] = useState(null);

  const refreshWorkouts = async ({ limit = initialLimit, offset = 0 } = {}) => {
    setLoadingWorkouts(true);
    setErrorWorkouts(null);
    try {
      const res = await listWorkouts({ limit, offset });
      const items = Array.isArray(res) ? res : (res.items || res.workouts || []);
      setWorkouts(items);
      setTotalCount((Array.isArray(res) ? items.length : (res.total || items.length)));
    } catch (e) {
      setErrorWorkouts('Failed to load workouts');
    } finally {
      setLoadingWorkouts(false);
    }
  };

  const refreshTemplates = async () => {
    setLoadingTemplates(true);
    setErrorTemplates(null);
    try {
      const res = await listTemplates();
      setTemplates(res.items || res.templates || res || []);
    } catch (e) {
      setErrorTemplates('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    refreshWorkouts();
    refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeWorkout = async (id) => {
    await deleteWorkout(id);
    setWorkouts((prev) => prev.filter((w) => String(w.id) !== String(id)));
  };

  const saveTemplate = async (tpl) => {
    const saved = await upsertTemplate(tpl);
    await refreshTemplates();
    return saved;
  };

  const removeTemplate = async (id) => {
    await apiDeleteTemplate(id);
    await refreshTemplates();
  };

  // Derive simple analytics from loaded workouts
  const analytics = useMemo(() => {
    if (!workouts || workouts.length === 0) {
      return { totalTonnage: 0, totalSessions: 0, totalSets: 0, topExercises: [] };
    }
    let totalTonnage = 0;
    let totalSets = 0;
    const exerciseMap = new Map(); // id/name -> { name, volume, count }
    workouts.forEach((w) => {
      totalTonnage += calcTonnage(w);
      (w.exercises || w.exercise_logs || []).forEach((ex) => {
        const name = ex.name || ex.exercise_name || `Exercise ${ex.exerciseDefinitionId || ex.exercise_definition_id || ex.exercise_id || ''}`;
        let vol = 0;
        (ex.sets || ex.exercise_sets || []).forEach((s) => {
          const w = s.weight ?? s.weight_kg ?? 0;
          const r = s.reps ?? s.repetitions ?? 0;
          if (w && r) vol += w * r;
        });
        totalSets += (ex.sets || ex.exercise_sets || []).length;
        const key = String(ex.exerciseDefinitionId || ex.exercise_definition_id || ex.exercise_id || name);
        const prev = exerciseMap.get(key) || { name, volume: 0, count: 0 };
        prev.volume += vol;
        prev.count += 1;
        exerciseMap.set(key, prev);
      });
    });
    const topExercises = Array.from(exerciseMap.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);
    return { totalTonnage, totalSessions: workouts.length, totalSets, topExercises };
  }, [workouts]);

  return {
    // data
    workouts,
    totalCount,
    templates,
    // loading/error
    loadingWorkouts,
    errorWorkouts,
    loadingTemplates,
    errorTemplates,
    // actions
    refreshWorkouts,
    refreshTemplates,
    removeWorkout,
    saveTemplate,
    removeTemplate,
    // helpers
    getWorkout,
    // derived
    analytics,
  };
}
