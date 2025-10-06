// Utilities describing metric properties (e.g. whether lower values are better)
const lowerIsBetterSet = new Set([
  'avg_pace',
  'avg_hr',
  'avg_stress'
]);

export function isLowerBetter(metric) {
  if (!metric) return false;
  return lowerIsBetterSet.has(metric.toString());
}

export function lowerIsBetterNote(metric) {
  if (!isLowerBetter(metric)) return '';
  // Human-friendly note
  const pretty = metric.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return ` Note: lower ${pretty} values indicate better performance.`;
}

const _default = { isLowerBetter, lowerIsBetterNote, lowerIsBetterSet };
export default _default;
