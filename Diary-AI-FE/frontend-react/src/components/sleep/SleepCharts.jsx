import React from 'react';
import HealthChart from '../HealthChart';

const SleepCharts = ({ timeseries, analysisParams }) => {
  const sleepScoreSeries = timeseries.map(d => ({ x: d.day, y: d.sleep_score }));
  const durationSeries = timeseries.map(d => ({ x: d.day, y: d.sleep_duration_minutes }));

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Sleep Charts</h3>
      </div>
      <div className="card-content">
        <HealthChart title="Sleep Score" series={[{ name: 'Sleep Score', data: sleepScoreSeries }]} />
        <div style={{ height: '1rem' }} />
        <HealthChart title="Sleep Duration (min)" series={[{ name: 'Duration', data: durationSeries }]} />
      </div>
    </div>
  );
};

export default SleepCharts;
