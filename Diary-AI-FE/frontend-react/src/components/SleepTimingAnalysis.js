import React from 'react';
import SleepGanttChart from './SleepGanttChart';

const SleepTimingAnalysis = ({ timing, derivedTiming, timeseries, analysisParams }) => {
  const {
    computedAvgBedMin,
    avgBedWindow,
    recommendedBedWindow,
    mmToHHMM,
  } = derivedTiming;

  return (
    <div className="sleep-timing">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sleep Timing & Consistency</h3>
        </div>
        <div className="charts-grid">
          <SleepGanttChart 
            timeseries={timeseries}
            maxDays={analysisParams.days}
            offset="22:00"
            domainMinutes={600}
          />
        </div>
        <div className="timing-content">
          <div className="timing-stats">
            {/* Average Bedtime Stat (enhanced) */}
            <div className="timing-stat enhanced">
              <div className="stat-left">
                <div className="stat-icon">🛏️</div>
                <div className="stat-content">
                  <div className="stat-label">Average Bedtime</div>
                  <div className="stat-value gradient-text">{computedAvgBedMin != null ? mmToHHMM(computedAvgBedMin) : 'N/A'}</div>
                  <div className="pills">
                    <span className="pill">
                      <span className="pill-dot" />
                      Typical: {avgBedWindow?.label || 'N/A'}
                    </span>
                    {recommendedBedWindow?.label && (
                      <span className="pill subtle">Recommended: {recommendedBedWindow.label}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="stat-right">
                <div className="consistency-row">
                  <div className="consistency-header">
                    <span>Consistency</span>
                    <span className="consistency-value">{timing?.bedtime_consistency != null ? `${Math.round(timing.bedtime_consistency)}%` : 'N/A'}</span>
                  </div>
                  <div className="progress">
                    <div className={`bar ${
                      timing?.bedtime_consistency >= 85 ? 'good' : timing?.bedtime_consistency >= 70 ? 'ok' : 'low'
                    }`} style={{ width: `${Math.max(0, Math.min(100, Math.round(timing?.bedtime_consistency || 0)))}%` }} />
                  </div>
                  <div className="consistency-badges">
                    {timing?.bedtime_consistency >= 85 && <span className="badge good">Highly consistent</span>}
                    {timing?.bedtime_consistency >= 70 && timing?.bedtime_consistency < 85 && <span className="badge ok">Consistent</span>}
                    {timing?.bedtime_consistency < 70 && <span className="badge low">Variable</span>}
                  </div>
                </div>
              </div>
            </div>

            <style jsx>{`
              .timing-stats { display: grid; gap: 16px; }
              .timing-stat.enhanced { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: center; padding: 16px; border-radius: 12px; background: var(--card-bg, rgba(148,163,184,0.08)); border: 1px solid var(--glass-border, rgba(148,163,184,0.15)); box-shadow: var(--glass-shadow, 0 4px 20px rgba(0,0,0,0.08)); }
              .stat-left { display: flex; align-items: center; gap: 12px; }
              .stat-icon { font-size: 28px; }
              .stat-content { display: flex; flex-direction: column; }
              .stat-label { color: var(--text-muted, #64748b); font-size: 0.9rem; }
              .stat-value { font-size: 2rem; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
              .gradient-text { background: linear-gradient(90deg, #38bdf8, #22c55e); -webkit-background-clip: text; background-clip: text; color: transparent; }
              .pills { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
              .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(56,189,248,0.12); color: #38bdf8; font-weight: 600; font-size: 0.85rem; }
              .pill .pill-dot { width: 8px; height: 8px; border-radius: 999px; background: #38bdf8; display: inline-block; }
              .pill.subtle { background: rgba(34,197,94,0.10); color: #22c55e; }

              .stat-right { display: flex; flex-direction: column; gap: 8px; }
              .consistency-row { width: 100%; }
              .consistency-header { display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-muted, #64748b); margin-bottom: 4px; }
              .consistency-value { color: var(--text-primary); font-weight: 700; }
              .progress { height: 10px; background: rgba(148,163,184,0.25); border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.08); }
              .progress .bar { height: 100%; border-radius: 999px; transition: width 300ms ease; background: #94a3b8; }
              .progress .bar.good { background: linear-gradient(90deg, #10b981, #22c55e); }
              .progress .bar.ok { background: linear-gradient(90deg, #f59e0b, #fde047); }
              .progress .bar.low { background: linear-gradient(90deg, #ef4444, #f97316); }
              .consistency-badges { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
              .badge { padding: 4px 8px; font-size: 0.75rem; border-radius: 8px; font-weight: 700; }
              .badge.good { background: rgba(16,185,129,0.15); color: #10b981; }
              .badge.ok { background: rgba(245,158,11,0.15); color: #f59e0b; }
              .badge.low { background: rgba(239,68,68,0.15); color: #ef4444; }

              @media (max-width: 900px) {
                .timing-stat.enhanced { grid-template-columns: 1fr; }
              }
            `}</style>
            {/* ... other stats for Wake Time and Recommendations ... */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SleepTimingAnalysis;