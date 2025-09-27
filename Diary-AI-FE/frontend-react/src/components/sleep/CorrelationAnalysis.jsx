import React from 'react';
import CorrelationHeatmap from '../CorrelationHeatmap';

const CorrelationAnalysis = ({ timeseries }) => {
  // Build a simple correlation matrix placeholder from timeseries (if available)
  // Expecting fields like sleep_score, steps, rhr, energy_level, mood
  const metrics = ['sleep_score', 'steps', 'rhr', 'energy_level', 'mood'];
  const data = [];
  if (Array.isArray(timeseries) && timeseries.length > 1) {
    const cols = metrics.map(m => timeseries.map(d => Number(d[m]) || 0));
    const corr = (a, b) => {
      const n = a.length;
      const ma = a.reduce((s, v) => s + v, 0) / n;
      const mb = b.reduce((s, v) => s + v, 0) / n;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < n; i++) {
        const xa = a[i] - ma;
        const xb = b[i] - mb;
        num += xa * xb; da += xa * xa; db += xb * xb;
      }
      const den = Math.sqrt(da * db) || 1;
      return Number((num / den).toFixed(2));
    };
    for (let i = 0; i < metrics.length; i++) {
      const row = [];
      for (let j = 0; j < metrics.length; j++) {
        row.push(corr(cols[i], cols[j]));
      }
      data.push(row);
    }
  }
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Correlation Analysis</h3>
      </div>
      <div className="card-content">
        <CorrelationHeatmap labels={metrics} matrix={data} />
      </div>
    </div>
  );
};

export default CorrelationAnalysis;
