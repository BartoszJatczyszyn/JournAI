import React from 'react';

const MetricCard = ({ 
  title, 
  value, 
  unit = '', 
  icon, 
  trend = null, 
  change = null, // percent-style change (preferred when available)
  deltaPct = null,
  percentChange = null,
  color = 'blue',
  subtitle,
  tooltip, // optional explanatory tooltip text
  onClick 
}) => {
  // Resolve percent-style change from multiple possible prop names for backward compatibility
  const resolvedChange = (deltaPct != null && Number.isFinite(deltaPct)) ? deltaPct
    : (percentChange != null && Number.isFinite(percentChange)) ? percentChange
    : (change != null && Number.isFinite(change)) ? change
    : null;
  const sig = (resolvedChange != null) ? resolvedChange : trend;

  const getTrendIcon = () => {
    if (sig > 0) {
      return (
        <svg className="trend-icon trend-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
        </svg>
      );
  } else if (sig < 0) {
      return (
        <svg className="trend-icon trend-down" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10m0-10h10" />
        </svg>
      );
    }
    return (
      <svg className="trend-icon trend-neutral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    );
  };

  const getTrendText = () => {
    // Prefer percent-style `change` when provided (e.g. 3.2 -> +3.2%)
    if (resolvedChange != null) {
      if (resolvedChange === 0) return 'No change';
      const sign = resolvedChange > 0 ? '+' : '';
      const abs = Math.abs(resolvedChange);
      // Use one decimal place for fractional percents, otherwise integer
      const fmt = abs < 1 ? abs.toFixed(1) : Math.round(abs);
      const dir = resolvedChange > 0 ? 'increase' : 'decrease';
      return `${sign}${fmt}% ${dir}`;
    }

    if (trend != null && Number.isFinite(trend)) {
      if (trend === 0) return 'No change';
      const absValue = Math.abs(trend);
      const direction = trend > 0 ? 'increase' : 'decrease';
      return `${absValue.toFixed(1)} ${direction}`;
    }

    return '—';
  };

  const getColorClasses = () => {
    const colors = {
      blue: 'metric-card-blue',
      green: 'metric-card-green',
      purple: 'metric-card-purple',
      red: 'metric-card-red',
      yellow: 'metric-card-yellow',
      indigo: 'metric-card-indigo'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div 
      className={`metric-card ${getColorClasses()} ${onClick ? 'metric-card-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="metric-header">
        <div className="metric-icon-group">
          <div className="metric-icon">{icon}</div>
          {tooltip && (
            <div className="metric-tooltip-wrapper">
              <span className="tooltip-trigger" aria-label={tooltip} role="img">ℹ️</span>
              <div className="metric-tooltip" role="tooltip">{tooltip}</div>
            </div>
          )}
        </div>
        <div className="metric-trend" title={(resolvedChange != null || trend != null) ? getTrendText() : ''}>
          {getTrendIcon()}
        </div>
      </div>
      
      <div className="metric-content">
        <div className="metric-value">
          {value}
          {unit && <span className="metric-unit">{unit}</span>}
        </div>
        <div className="metric-title">{title}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>

    <div className="metric-footer">
  <span className="trend-text">{(resolvedChange != null || trend != null) ? getTrendText() : '—'}</span>
    </div>

  <style>{`
        .metric-card {
          background: linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%);
          color: white;
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
          pointer-events: none;
        }

        .metric-card-clickable {
          cursor: pointer;
        }

        .metric-card-clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        .metric-card-blue {
          --gradient-from: #3b82f6;
          --gradient-to: #1d4ed8;
        }

        .metric-card-green {
          --gradient-from: #10b981;
          --gradient-to: #059669;
        }

        .metric-card-purple {
          --gradient-from: #8b5cf6;
          --gradient-to: #7c3aed;
        }

        .metric-card-red {
          --gradient-from: #ef4444;
          --gradient-to: #dc2626;
        }

        .metric-card-yellow {
          --gradient-from: #f59e0b;
          --gradient-to: #d97706;
        }

        .metric-card-indigo {
          --gradient-from: #6366f1;
          --gradient-to: #4f46e5;
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 12px;
        }

        .metric-icon-group {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .metric-tooltip-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .tooltip-trigger {
          font-size: 0.95rem;
          cursor: help;
          opacity: 0.85;
          transition: opacity 0.2s ease;
        }

        .tooltip-trigger:hover + .metric-tooltip,
        .metric-tooltip-wrapper:focus-within .metric-tooltip {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .metric-tooltip {
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 10;
          background: var(--glass-bg, rgba(17,24,39,0.95));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.06));
          box-shadow: 0 6px 18px rgba(2,6,23,0.6);
          color: var(--text-primary, #f1f5f9);
          padding: 8px 10px;
          font-size: 0.75rem;
          line-height: 1.2;
          border-radius: 8px;
          width: 220px;
          margin-top: 8px;
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.18s ease, transform 0.18s ease;
          pointer-events: none;
        }

        .metric-tooltip::after {
          content: '';
          position: absolute;
          top: -6px;
          left: 14px;
          width: 12px;
          height: 12px;
          background: var(--glass-bg, rgba(17,24,39,0.95));
          transform: rotate(45deg);
        }

        .metric-icon {
          font-size: 2rem;
          opacity: 0.9;
        }

        .metric-trend {
          opacity: 0.8;
        }

        .trend-icon {
          width: 20px;
          height: 20px;
        }

        .trend-up {
          color: #10b981;
        }

        .trend-down {
          color: #ef4444;
        }

        .trend-neutral {
          color: #6b7280;
        }

        .metric-content {
          margin-bottom: 16px;
        }

        .metric-value {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 8px;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .metric-unit {
          font-size: 1rem;
          font-weight: 500;
          opacity: 0.8;
        }

        .metric-title {
          font-size: 1rem;
          font-weight: 600;
          opacity: 0.9;
          margin-bottom: 4px;
        }

        .metric-subtitle {
          font-size: 0.875rem;
          opacity: 0.7;
        }

        .metric-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .trend-text {
          font-size: 0.75rem;
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 8px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        @media (max-width: 768px) {
          .metric-card {
            padding: 20px;
          }

          .metric-value {
            font-size: 2rem;
          }

          .metric-icon {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .metric-card {
            padding: 16px;
          }

          .metric-value {
            font-size: 1.75rem;
          }

          .metric-title {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MetricCard;