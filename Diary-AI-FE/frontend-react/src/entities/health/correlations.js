// Health correlations domain mapping
export function mapCorrelationMatrixDto(dto){
  // Expect { metrics: string[], matrix: number[][] } or object map
  if (!dto) return { metrics: [], matrix: [] };
  if (Array.isArray(dto.metrics) && Array.isArray(dto.matrix)) return dto;
  // If backend returns map { metricA: { metricB: value } }
  if (typeof dto === 'object'){
    const metrics = Object.keys(dto);
    const matrix = metrics.map(m1 => metrics.map(m2 => Number(dto[m1]?.[m2]) || (m1===m2?1:0)));
    return { metrics, matrix };
  }
  return { metrics: [], matrix: [] };
}

export function mapCorrelationPairsDto(dto){
  // Expect [{ a, b, r }]
  if (!Array.isArray(dto)) return [];
  return dto.map(p => ({ a: p.a || p.x || p.first, b: p.b || p.y || p.second, r: Number(p.r ?? p.value ?? 0) }));
}
