import React from 'react';
import { RangeControls } from 'shared/ui';

const DashboardHeader = ({ title = 'Health Dashboard', subtitle = 'Your comprehensive health overview with AI-powered insights', dateRange, onSelectDays, availableDays: _availableDays }) => {
  return (
    <div className="dashboard-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="dashboard-controls">
        <RangeControls days={dateRange} onChangeDays={onSelectDays} />
      </div>
    </div>
  );
};

export default DashboardHeader;
