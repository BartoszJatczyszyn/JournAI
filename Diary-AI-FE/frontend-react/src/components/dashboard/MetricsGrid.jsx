import React from 'react';
import MetricCard from '../MetricCard';

const MetricsGrid = ({ avgEnergy, avgSleep, avgSteps, avgRHR, computeTrend, recentData }) => {
  return (
    <div className="metrics-grid">
      <MetricCard
        title="Energy Level"
        value={avgEnergy}
        unit="/5"
        icon="⚡"
        trend={computeTrend('energy_level', recentData)}
        color="blue"
      />
      <MetricCard
        title="Sleep Score"
        value={avgSleep}
        unit="/100"
        icon="😴"
        trend={computeTrend('sleep_score', recentData)}
        color="purple"
      />
      <MetricCard
        title="Daily Steps"
        value={typeof avgSteps === 'number' ? avgSteps.toLocaleString() : avgSteps}
        unit=""
        icon="🏃"
        trend={computeTrend('steps', recentData)}
        color="green"
      />
      <MetricCard
        title="Resting HR"
        value={avgRHR}
        unit="bpm"
        icon="❤️"
        trend={computeTrend('rhr', recentData)}
        color="red"
      />
    </div>
  );
};

export default MetricsGrid;
