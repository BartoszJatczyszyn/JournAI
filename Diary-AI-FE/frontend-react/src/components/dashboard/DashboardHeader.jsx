import React from 'react';

const DashboardHeader = ({ title = 'Health Dashboard', subtitle = 'Your comprehensive health overview with AI-powered insights', dateRange, onSelectDays, availableDays }) => {
  return (
    <div className="dashboard-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="dashboard-controls">
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <select
            value={dateRange}
            onChange={(e) => onSelectDays(Number(e.target.value))}
            className="date-range-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 2 months</option>
            <option value={90}>Last 3 months</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
