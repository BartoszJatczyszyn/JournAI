import React from 'react';

const Zone = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <div style={{ width: 12, height: 12, background: color }} />
    <span>{label}</span>
  </div>
);

const SleepQualityZones = () => (
  <div className="card">
    <div className="card-header">
      <h3 className="card-title">Sleep Score Zones</h3>
    </div>
    <div className="card-content" style={{ display: 'flex', gap: '1rem' }}>
      <Zone color="#d9534f" label="Poor (0-59)" />
      <Zone color="#f0ad4e" label="Fair (60-69)" />
      <Zone color="#5bc0de" label="Good (70-79)" />
      <Zone color="#5cb85c" label="Excellent (80-100)" />
    </div>
  </div>
);

export default SleepQualityZones;
