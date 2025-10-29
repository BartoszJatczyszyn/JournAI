// Activities domain models and mappers

export function mapActivityDtoToModel(dto) {
  if (!dto) return null;
  return {
    id: dto.id ?? dto.activity_id ?? null,
    type: (dto.sport || dto.type || '').toLowerCase() || 'unknown',
    startTime: dto.start_time || dto.startedAt || null,
    durationMin: dto.duration_min ?? (dto.duration_seconds != null ? Math.round(dto.duration_seconds/60) : null),
    distanceKm: dto.distance_km ?? dto.distance ?? (dto.distance_m != null ? dto.distance_m/1000 : null),
    paceMinPerKm: dto.pace_min_per_km ?? dto.pace ?? null,
    calories: dto.calories ?? null,
    avgHr: dto.avg_hr ?? dto.avgHeartRate ?? null,
    maxHr: dto.max_hr ?? dto.maxHeartRate ?? null,
  };
}

export function mapActivitiesDtoToModel(list) {
  return Array.isArray(list) ? list.map(mapActivityDtoToModel) : [];
}
