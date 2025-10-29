import React from 'react';

const SleepRecommendations = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Recommendations</h3>
      </div>
      <div className="card-content">
        <ul>
          {recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SleepRecommendations;
