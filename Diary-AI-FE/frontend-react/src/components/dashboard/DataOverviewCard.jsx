import React, { useMemo } from 'react';

// Helper formatting
const fmtInt = (v) => (v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString());
// _fmt1 removed (unused)

const DataOverviewCard = ({ stats }) => {
  // Normalize incoming stats (backend /api/stats shape)
  const normalized = stats || {};
  const days = normalized.days_count || 0;
  const avgSteps = normalized.avg_steps;
  const avgCalories = normalized.avg_calories;
  const avgRhr = normalized.avg_rhr;
  const avgStress = normalized.avg_stress;
  const firstDay = normalized.first_day;
  const lastDay = normalized.last_day;

  const coverage = useMemo(() => {
    if (!firstDay || !lastDay) return '—';
    try {
      const fd = new Date(firstDay); const ld = new Date(lastDay);
      if (isNaN(fd) || isNaN(ld)) return '—';
      const diff = Math.round((ld - fd) / 86400000) + 1;
      return diff + 'd span';
    } catch { return '—'; }
  }, [firstDay, lastDay]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Data Overview</h3>
        <p className="card-subtitle" style={{margin:0,fontSize:'0.75rem',color:'var(--text-muted)'}}>Aggregate metrics (anchored on last real day)</p>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{fmtInt(days)}</div>
          <div className="stat-label">Valid Days</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{fmtInt(avgSteps)}</div>
          <div className="stat-label">Avg Steps</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{fmtInt(avgCalories)}</div>
          <div className="stat-label">Avg Calories</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{avgRhr != null ? Math.round(avgRhr) : '—'}</div>
          <div className="stat-label">Avg RHR</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{avgStress != null ? Math.round(avgStress) : '—'}</div>
          <div className="stat-label">Avg Stress</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" title={firstDay && lastDay ? `${firstDay} → ${lastDay}` : ''}>{coverage}</div>
          <div className="stat-label">Date Span</div>
        </div>
      </div>
      <style jsx>{`
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:16px; }
        .stat-item { background:var(--card-alt-bg,#f8fafc); padding:12px 10px; border-radius:8px; text-align:center; }
        .dark .stat-item { background:#334155; }
        .stat-value { font-size:1.15rem; font-weight:600; color:var(--text-primary,#1e293b); }
        .stat-label { font-size:0.7rem; letter-spacing:.5px; text-transform:uppercase; color:var(--text-muted,#64748b); font-weight:600; }
      `}</style>
    </div>
  );
};

export default DataOverviewCard;
