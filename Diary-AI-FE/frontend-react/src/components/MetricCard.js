import React from 'react';

const MetricCard = ({ 
  title, 
  value, 
  unit = '', 
  icon, 
  trend = 0, 
  color = 'blue',
  subtitle,
  onClick 
}) => {
  const getTrendIcon = () => {
    if (trend > 0) {
      return (
        <svg className="trend-icon trend-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7m0 10H7" />
        </svg>
      );
    } else if (trend < 0) {
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
    if (trend === 0) return 'No change';
    const absValue = Math.abs(trend);
    const direction = trend > 0 ? 'increase' : 'decrease';
    return `${absValue.toFixed(1)} ${direction}`;
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
        <div className="metric-icon">{icon}</div>
        <div className="metric-trend">
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
        <span className="trend-text">{getTrendText()}</span>
      </div>

      <style jsx>{`
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