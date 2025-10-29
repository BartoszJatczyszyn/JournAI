// Activity analysis domain mapping
export function mapActivityAnalysisDto(dto){
  if (!dto) return { weekly: [], correlations: {}, highlights: [] };
  const weekly = Array.isArray(dto.weekly) ? dto.weekly.map(w => ({
    week: w.week,
    total_distance_km: Number(w.total_distance_km ?? w.distance ?? 0),
    avg_pace: Number(w.avg_pace ?? w.rollingAvgPace4 ?? 0),
    active_days: Number(w.active_days ?? w.activeDays ?? w.active_days_count ?? 0),
  })) : [];
  const correlations = dto.correlations || {};
  const highlights = dto.highlights || [];
  return { weekly, correlations, highlights };
}
