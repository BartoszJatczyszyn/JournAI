// Health domain models and mappers (minimal placeholders; extend as needed)

export function mapHealthTrendsDto(dto) {
  return dto || {};
}

export function mapPredictionResultDto(dto) {
  // normalize status and predictions list/object
  if (!dto) return { status: 'unknown', predictions: [] };
  return {
    status: dto.status || 'ok',
    predictions: dto.predictions || dto.items || dto.data || [],
    message: dto.message || null,
  };
}
