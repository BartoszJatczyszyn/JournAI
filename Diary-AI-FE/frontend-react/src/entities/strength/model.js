// Strength domain models and mappers

export function mapWorkoutDtoToModel(dto) {
  if (!dto) return null;
  const exercises = (dto.exercises || dto.exercise_logs || []).map(ex => ({
    id: ex.id ?? ex.exercise_id ?? null,
    name: ex.name || ex.exercise || 'Exercise',
    sets: (ex.sets || ex.exercise_sets || []).map(s => ({
      weightKg: s.weight ?? s.weight_kg ?? 0,
      reps: s.reps ?? s.repetitions ?? 0,
    })),
  }));
  return {
    id: dto.id ?? dto.workout_id ?? null,
    name: dto.name || 'Workout',
    startedAt: dto.startedAt || dto.date || dto.start_time || null,
    notes: dto.notes || '',
    exercises,
  };
}

export function mapWorkoutsDtoToModel(list) {
  return Array.isArray(list) ? list.map(mapWorkoutDtoToModel) : [];
}

export function mapTemplateDtoToModel(dto) {
  if (!dto) return null;
  return {
    id: dto.id ?? dto.template_id ?? null,
    name: dto.name || 'Template',
    exercises: (dto.exercises || []).map(e => ({
      name: e.name,
      defaultSets: e.defaultSets ?? e.sets ?? 3,
      defaultReps: e.defaultReps ?? e.reps ?? 8,
      defaultWeight: e.defaultWeight ?? e.weight ?? 0,
    })),
  };
}
