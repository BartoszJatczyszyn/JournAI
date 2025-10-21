import React from 'react';
import HealthChart from '../HealthChart';

const HealthTrendsCard = ({ selectedMetric, onChangeMetric, windowData }) => {
  // Decide chart type & rolling average heuristics
  const decideChartProps = (metric) => {
    // Bar for discrete count-like metrics; line for continuous; area optional later
    if (metric === 'steps' || metric === 'calories_total') return { type: 'bar' };
    if (metric === 'rhr') return { type: 'line', rollingWindow: 7 };
    if (metric === 'stress_avg') return { type: 'line', rollingWindow: 7 };
    if (metric === 'sleep_score') return { type: 'line', rollingWindow: 5 };
    return { type: 'line' };
  };
  const chartProps = decideChartProps(selectedMetric);
  return (
    <div className="chart-container-wrapper">
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Health Trends</h3>
            <p className="card-subtitle">Track your key health metrics over time</p>
          </div>
          <select
            value={selectedMetric}
            onChange={(e) => onChangeMetric(e.target.value)}
            className="select-glass metric-select"
          >
            <option value="energy_level">Energy Level</option>
            <option value="sleep_score">Sleep Score</option>
            <option value="steps">Steps</option>
            <option value="rhr">Resting Heart Rate</option>
            <option value="stress_avg">Stress</option>
            <option value="calories_total">Calories</option>
            <option value="mood">Mood</option>
          </select>
        </div>
        <HealthChart
          key={`hc-${selectedMetric}-${windowData.length}`}
          data={windowData}
          metric={selectedMetric}
          height={300}
          type={chartProps.type}
          rollingWindow={chartProps.rollingWindow}
        />
      </div>
    </div>
  );
};

export default HealthTrendsCard;
