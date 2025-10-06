import React, { useMemo } from 'react';
import HealthChart from './HealthChart';

/**
 * Stacked charts for Pace Form section (placed below summary panel).
 * Props:
 *  - runs: ascending array (older -> newer) with fields { day, avg_pace, pace_z, performance_score }
 */
export default function RunningPaceFormCharts({ runs }) {
  const paceSeries = useMemo(()=>{
    if (!Array.isArray(runs)) return [];
    return runs.filter(r=>r && r.avg_pace!=null).map(r=>({ day: r.day, pace: r.avg_pace }));
  },[runs]);
  const formSeries = useMemo(()=>{
    if (!Array.isArray(runs)) return [];
    return runs.filter(r=>r && (r.pace_z!=null || r.performance_score!=null)).map(r=>({ day: r.day, pace_z: r.pace_z, form_score: r.performance_score }));
  },[runs]);

  if (!paceSeries.length && !formSeries.length) return null;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Pace / Form Charts</h3>
        <span className="text-[10px] text-gray-500">Chronological</span>
      </div>
      <div className="card-content space-y-6">
        {paceSeries.length > 2 ? (
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Pace (min/km)</div>
            <HealthChart
              data={paceSeries}
              metric="pace"
              height={160}
              type="line"
              color="#10b981"
              showTooltip
              showGrid
              rollingWindow={5}
              raColor="#0d9488"
              xLabel="Date"
              yLabel="Pace (min/km)"
            />
          </div>
        ) : (
          <div className="text-[11px] text-gray-500">Not enough pace data (need &gt; 2).</div>
        )}
        {formSeries.length > 2 ? (
          <div>
            <div className="text-[11px] text-gray-500 mb-1">Form Score (rolling 5)</div>
            <HealthChart
              data={formSeries.map(r=>({ ...r, form_score: r.form_score }))}
              metric="form_score"
              height={160}
              type="line"
              color="#6366f1"
              showTooltip
              showGrid
              rollingWindow={5}
              raColor="#94a3b8"
              xLabel="Date"
              yLabel="Form Score"
            />
          </div>
        ) : (
          <div className="text-[11px] text-gray-500">Not enough form data (need &gt; 2).</div>
        )}
      </div>
    </div>
  );
}
