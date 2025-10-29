// Recovery analysis domain mapping
export function mapRecoveryAnalysisDto(dto){
  if (!dto) return { summary: {}, drivers: [], recommendations: [] };
  const summary = dto.summary || {};
  const drivers = Array.isArray(dto.drivers) ? dto.drivers.map(d => ({
    metric: d.metric || d.name,
    impact: Number(d.impact ?? d.weight ?? 0),
    direction: d.direction || (Number(d.impact ?? 0) >= 0 ? 'positive' : 'negative'),
  })) : [];
  const recommendations = dto.recommendations || [];
  return { summary, drivers, recommendations };
}
