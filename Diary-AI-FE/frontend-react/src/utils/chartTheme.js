// Centralized chart theme and palette for Recharts / Chart.js
export const chartPalette = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

export const seriesColors = [
  chartPalette.blue,
  chartPalette.teal,
  chartPalette.indigo,
  chartPalette.purple,
  chartPalette.green,
  chartPalette.amber,
  chartPalette.red,
  chartPalette.pink,
  chartPalette.slate,
];

export const getSeriesColor = (i = 0) => seriesColors[i % seriesColors.length];

export const tooltipStyle = {
  backgroundColor: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-primary)',
  borderRadius: 10,
  padding: '10px 12px',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  boxShadow: 'var(--glass-shadow)'
};

// For Chart.js default options
export const chartJsDefaults = {
  plugins: {
    legend: { labels: { color: 'var(--text-primary)' } },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.9)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: 'var(--text-primary)',
      bodyColor: 'var(--text-primary)'
    }
  },
  scales: {
    x: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { color: 'var(--text-muted)' } },
    y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { color: 'var(--text-muted)' } }
  }
};
