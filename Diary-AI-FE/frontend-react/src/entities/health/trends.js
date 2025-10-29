// Health trends and temporal patterns mapping
export function mapHealthTrendsDto(dto){
  if (!dto) return { series: [] };
  const series = Array.isArray(dto.series) ? dto.series : [];
  return { series };
}

export function mapTemporalPatternsDto(dto){
  // Expect { patterns: [...] } or array
  if (!dto) return { patterns: [] };
  if (Array.isArray(dto)) return { patterns: dto };
  return { patterns: dto.patterns || [] };
}
