import React, { useMemo } from 'react';
import Tooltip from './Tooltip';
import Sparkline from './Sparkline';

/** Displays VO2max raw values + regression projections (30d/60d). 
    Behavior:
      - If raw VO2 points exist: show sparkline + backend trend summary (if available)
      - If no raw points but backend trend exists: show trend summary
      - If neither: show actionable fallback message
*/
export default function RunningVO2MaxTrend({ runs, trend }) {
  const points = useMemo(()=>{
    if (!Array.isArray(runs)) return [];
    return runs.filter(r=>r && r.vo2_max != null).map(r=>({ value: Number(r.vo2_max), label: r.day||r.start_time }));
  },[runs]);

  const hasBackendTrend = trend && (typeof trend === 'object');

  const fmt = v => (v != null && !Number.isNaN(Number(v))) ? Number(v).toFixed(1) : '—';

  // No raw points: decide what to show depending on backend sample count
  if (!points.length) {
    const samples = Number.isFinite(Number(trend?.samples)) ? Number(trend.samples) : null;
    // If backend reports zero samples or no trend info at all -> show actionable fallback
    if (samples === 0 || (!hasBackendTrend)) {
      return (
        <div className="card h-full">
          <div className="card-header"><h3 className="card-title">VO2max Trend</h3></div>
          <div className="card-content text-xs text-gray-500">No VO2max data available — try syncing your device or check that your running activities include VO2max measurements.</div>
        </div>
      );
    }
    // If backend has 1-2 samples, show summary but mark as insufficient for projections
    if (samples != null && samples > 0 && samples < 3) {
      return (
        <div className="card h-full">
          <div className="card-header">
            <h3 className="card-title">VO2max Trend</h3>
          </div>
          <div className="card-content text-sm space-y-2">
            <div className="text-xs text-gray-400">No raw VO2max points available for plotting — backend has insufficient samples for reliable projections.</div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div>Samples: <strong>{trend.samples ?? '—'}</strong></div>
              <div>Latest: <strong>{fmt(trend.current)}</strong></div>
              <div>Mean: <strong>{fmt(trend.mean)}</strong></div>
              <div>Slope/day: <strong>{trend.slope_per_day != null ? Number(trend.slope_per_day).toFixed(4) : '—'}</strong></div>
              <div>Change (30d): <strong>{trend.change_per_30d != null ? Number(trend.change_per_30d).toFixed(1) : '—'}</strong></div>
              <div>r: <strong>{trend.r != null ? Number(trend.r).toFixed(3) : '—'}</strong></div>
            </div>
          </div>
        </div>
      );
    }
    // samples >= 3 -> show full backend summary/projections
    if (samples == null || samples >= 3) {
      return (
        <div className="card h-full">
          <div className="card-header">
            <h3 className="card-title">VO2max Trend</h3>
          </div>
          <div className="card-content text-sm space-y-2">
            <div className="text-xs text-gray-400">No raw VO2max points available for plotting — showing backend summary/projections.</div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div>Samples: <strong>{trend.samples ?? '—'}</strong></div>
              <div>Latest: <strong>{fmt(trend.current)}</strong></div>
              <div>Mean: <strong>{fmt(trend.mean)}</strong></div>
              <div>Slope/day: <strong>{trend.slope_per_day != null ? Number(trend.slope_per_day).toFixed(4) : '—'}</strong></div>
              <div>Change (30d): <strong>{trend.change_per_30d != null ? Number(trend.change_per_30d).toFixed(1) : '—'}</strong></div>
              <div>r: <strong>{trend.r != null ? Number(trend.r).toFixed(3) : '—'}</strong></div>
              <div>Projection 30d: <strong>{fmt(trend.projection_30d)}</strong></div>
              <div>Projection 60d: <strong>{fmt(trend.projection_60d)}</strong></div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Raw points exist: show sparkline and, if backend trend exists, show the summary alongside
  const latest = points[points.length-1];
  // compute simple local stats as fallback when backend trend missing
  const localVals = points.map(p=>p.value).filter(v=>v != null && !Number.isNaN(Number(v))).map(Number);
  const localMean = localVals.length ? (localVals.reduce((a,b)=>a+b,0)/localVals.length) : null;

  return (
    <div className="card h-full">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title flex items-center gap-2">VO2max Trend <Tooltip content="Raw VO2max values from runs (when available) in chronological order." /></h3>
        <span className="text-[10px] text-gray-500">Chronological →</span>
      </div>
      <div className="card-content space-y-2">
        <Sparkline data={points} height={70} stroke="#6366f1" fill="rgba(99,102,241,0.15)" />
        <div className="grid grid-cols-2 gap-2 text-[13px] text-gray-400">
          <div>Latest: <strong>{latest?.value != null ? Number(latest.value).toFixed(1) : '—'}</strong></div>
          <div>Samples (raw): <strong>{points.length}</strong></div>
          <div>Local mean: <strong>{localMean != null ? Number(localMean).toFixed(1) : '—'}</strong></div>
          <div>Backend samples: <strong>{trend?.samples ?? '—'}</strong></div>
          <div>Slope/day: <strong>{trend?.slope_per_day != null ? Number(trend.slope_per_day).toFixed(4) : '—'}</strong></div>
          <div>Change (30d): <strong>{trend?.change_per_30d != null ? Number(trend.change_per_30d).toFixed(1) : '—'}</strong></div>
          <div>Projection 30d: <strong>{trend?.projection_30d != null ? fmt(trend.projection_30d) : '—'}</strong></div>
          <div>Projection 60d: <strong>{trend?.projection_60d != null ? fmt(trend.projection_60d) : '—'}</strong></div>
          <div>r: <strong>{trend?.r != null ? Number(trend.r).toFixed(3) : '—'}</strong></div>
        </div>
      </div>
    </div>
  );
}
