// Utility helpers for charts across the app

export const minutesToHHMM = (m) => {
  if (m == null || isNaN(m)) return '—';
  const mm = Math.round(m) % 1440;
  const h = Math.floor(mm / 60);
  const min = mm % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

export const parseChartOffset = (hhmm = '23:00') => {
  if (typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
};

export const getSleepScoreColor = (score, fallback = '#0ea5e9') => {
  const s = Number(score);
  if (!Number.isFinite(s)) return fallback;
  // Unified palette:
  // Poor (0-59) -> red
  // Fair (60-69) -> yellow
  // Good (70-79) -> blue
  // Excellent (80-100) -> green
  if (s >= 80) return '#10b981'; // green (Excellent)
  if (s >= 70) return '#3b82f6'; // blue (Good)
  if (s >= 60) return '#f59e0b'; // yellow (Fair)
  return '#ef4444'; // red (Poor)
};
