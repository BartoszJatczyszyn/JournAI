// Sleep entity model and mappers
// This creates a stable contract within the domain and decouples UI from infrastructure shapes.

export function mapSleepSummaryDtoToModel(dto) {
  if (!dto) return null;
  return {
    avgSleepScore: dto.avg_sleep_score ?? null,
    avgDurationMinutes: dto.avg_sleep_duration_minutes ?? dto.avg_duration_minutes ?? null,
    avgDeepMinutes: dto.avg_deep_sleep_minutes ?? null,
    avgRemMinutes: dto.avg_rem_sleep_minutes ?? null,
  };
}

export function mapSleepItemDtoToModel(dto) {
  if (!dto) return null;
  return {
    // Canonical domain fields
    id: dto.id ?? dto.sleep_id ?? null,
    // Preserve original DTO id for backward compatibility
    sleep_id: dto.sleep_id ?? dto.id ?? null,
    day: dto.day ?? dto.date ?? null,
    score: dto.sleep_score ?? dto.score ?? null,
    // Preserve original DTO score field for backward compatibility with older UI
    sleep_score: dto.sleep_score ?? dto.score ?? null,
    durationMinutes: dto.sleep_duration_minutes ?? dto.duration_minutes ?? null,
    deepMinutes: dto.deep_sleep_minutes ?? null,
    remMinutes: dto.rem_sleep_minutes ?? null,

    // Preserve useful raw/infrastructure fields for backward compatibility with UI
    // that still reads DTO-shaped properties (avoid breaking existing views)
    sleep_start: dto.sleep_start ?? dto.start ?? null,
    sleep_end: dto.sleep_end ?? dto.end ?? null,
    sleep_duration_seconds: dto.sleep_duration_seconds ?? dto.duration_seconds ?? null,
    duration_min: dto.duration_min ?? dto.duration_minutes ?? null,

    // per-stage seconds (some backends provide seconds, some minutes)
    deep_sleep_seconds: dto.deep_sleep_seconds ?? (dto.deep_sleep_minutes ? Math.round(dto.deep_sleep_minutes * 60) : null) ?? null,
    light_sleep_seconds: dto.light_sleep_seconds ?? (dto.light_sleep_minutes ? Math.round(dto.light_sleep_minutes * 60) : null) ?? null,
    rem_sleep_seconds: dto.rem_sleep_seconds ?? (dto.rem_sleep_minutes ? Math.round(dto.rem_sleep_minutes * 60) : null) ?? null,
    awake_seconds: dto.awake_seconds ?? (dto.awake_minutes ? Math.round(dto.awake_minutes * 60) : null) ?? null,

    // additional helpful fields
    sleep_events: dto.sleep_events ?? dto.events ?? dto.garmin_sleep_events ?? null,
    efficiency_pct: dto.efficiency_pct ?? dto.efficiency ?? null,
    last_sleep_phase: dto.last_sleep_phase ?? null,
    last_sleep_phase_label: dto.last_sleep_phase_label ?? null,
    last_pre_wake_phase: dto.last_pre_wake_phase ?? null,
    last_pre_wake_phase_label: dto.last_pre_wake_phase_label ?? null,
  // Per-session aggregated vitals (avg HR, RR, stress)
  avg_sleep_hr: dto.avg_sleep_hr ?? dto.avg_hr ?? dto.rhr ?? dto.resting_heart_rate ?? null,
  rhr: dto.avg_sleep_hr ?? dto.avg_hr ?? dto.rhr ?? dto.resting_heart_rate ?? null,
  avg_sleep_rr: dto.avg_sleep_rr ?? dto.avg_respiration ?? dto.respiratory_rate ?? null,
  respiratory_rate: dto.avg_sleep_rr ?? dto.avg_respiration ?? dto.respiratory_rate ?? null,
  avg_sleep_stress: dto.avg_sleep_stress ?? dto.stress_avg ?? dto.stress ?? null,
    // SpO2 (blood oxygen) metrics
    avg_spo2: dto.avg_spo2 ?? dto.spo2_avg ?? dto.avg_spo2_pct ?? dto.spo2_avg_pct ?? null,
    highest_spo2: dto.highest_spo2 ?? dto.spo2_highest ?? dto.max_spo2 ?? null,
    lowest_spo2: dto.lowest_spo2 ?? dto.spo2_lowest ?? dto.min_spo2 ?? null,
  };
}

export function mapTimeseriesDtoToModel(list) {
  return Array.isArray(list) ? list.map(mapSleepItemDtoToModel) : [];
}
