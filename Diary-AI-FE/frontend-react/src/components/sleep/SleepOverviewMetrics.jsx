import React from 'react';

const Metric = ({ label, value, suffix }) => (
  <div className="metric">
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value != null ? value : 'N/A'}{suffix || ''}</div>
  </div>
);

const SleepOverviewMetrics = ({ metrics, avgDuration }) => {
  if (!metrics) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Sleep Quality Summary</h3>
      </div>
      <div className="card-content metrics-grid">
        <Metric label="Avg Sleep Score" value={Math.round(metrics.avg_sleep_score)} />
        <Metric label="Avg Duration" value={Math.round(avgDuration)} suffix=" min" />
        <Metric label="Deep Sleep" value={Math.round(metrics.avg_deep_sleep_minutes)} suffix=" min" />
        <Metric label="REM Sleep" value={Math.round(metrics.avg_rem_sleep_minutes)} suffix=" min" />
      </div>
    </div>
  );
};

export default SleepOverviewMetrics;
