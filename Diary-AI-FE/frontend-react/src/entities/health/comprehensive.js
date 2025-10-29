// Comprehensive analysis mapping
export function mapComprehensiveDto(dto){
  if (!dto) return { insights: {}, sources: {} };
  // pass-through but ensure shapes
  const insights = dto.insights || {};
  return {
    insights: {
      daily_summary: insights.daily_summary || insights.dailySummaries || [],
      recommendations: insights.recommendations || [],
      notes: insights.notes || null,
    },
    sources: dto.sources || {},
  };
}
