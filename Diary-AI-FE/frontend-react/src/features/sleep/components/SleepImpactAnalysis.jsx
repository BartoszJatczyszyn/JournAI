import React from 'react';

const Row = ({ label, value }) => (
  <tr>
    <td>{label}</td>
    <td style={{ textAlign: 'right' }}>{value != null ? value : 'N/A'}</td>
  </tr>
);

const SleepImpactAnalysis = ({ impact, timeseries }) => {
  if (!impact) return null;
  const { correlations = {}, regression = {} } = impact;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Sleep Impact Analysis</h3>
      </div>
      <div className="card-content">
        <h4>Correlations with Sleep Score</h4>
        <table className="table">
          <tbody>
            {Object.entries(correlations).map(([k, v]) => (
              <Row key={k} label={k} value={typeof v === 'number' ? v.toFixed(2) : v} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SleepImpactAnalysis;
