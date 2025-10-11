import React from 'react';
import { Button } from '../ui';

const SleepPageHeader = ({ params, onParamsChange, onRefresh, loading }) => {
  const handleDaysChange = (e) => {
    const days = parseInt(e.target.value, 10);
    if (!Number.isNaN(days)) onParamsChange({ days });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Sleep Analysis</h2>
      </div>
      <div className="card-content" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label>
          Period (days):
          <select value={params.days} onChange={handleDaysChange} disabled={loading} style={{ marginLeft: '0.5rem' }}>
            {[7, 14, 21, 30, 60, 90].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <Button variant="ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
};

export default SleepPageHeader;
