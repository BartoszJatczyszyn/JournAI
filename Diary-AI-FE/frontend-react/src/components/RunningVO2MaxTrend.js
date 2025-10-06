import React, { useMemo } from 'react';
import Tooltip from './Tooltip';
import HealthChart from './HealthChart';

/** Displays VO2max raw values + regression projections (30d/60d). 
    Behavior:
      - If raw VO2 points exist: show sparkline + backend trend summary (if available)
      - If no raw points but backend trend exists: show trend summary
      - If neither: show actionable fallback message
*/
export default function RunningVO2MaxTrend({ runs, trend }) {
  const points = useMemo(()=>{
    if (!Array.isArray(runs)) return [];
    const pts = runs
      .filter(r=>r && r.vo2_max != null)
      .map(r=>{
        const label = r.day || r.start_time;
        const dayObj = label ? new Date(label) : null;
        return { value: Number(r.vo2_max), label, dayObj };
      });
    // sort newest-first. HealthChart reverses incoming arrays, so providing newest-first
    // ensures the final rendered chart is chronological left → right (older → newer)
    pts.sort((a,b)=>{
      const ta = a.dayObj ? a.dayObj.getTime() : 0;
      const tb = b.dayObj ? b.dayObj.getTime() : 0;
      return tb - ta;
    });
    return pts;
  },[runs]);

  const hasBackendTrend = trend && (typeof trend === 'object');

  

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
            <div className="text-xs text-gray-400">No raw VO2max points available for plotting — backend trend/projections are available but hidden.</div>
          </div>
        </div>
      );
    }
  }

  // Raw points exist: show sparkline and, if backend trend exists, show the summary alongside
  // no inline local stats required after removing the metrics summary

  return (
    <div className="card h-full">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title flex items-center gap-2">VO2max Trend <Tooltip content="Raw VO2max values from runs (when available) in chronological order." /></h3>
        <span className="text-[10px] text-gray-500">Chronological →</span>
      </div>
      <div className="card-content space-y-4">
        <div>
          <div className="text-[11px] text-gray-500 mb-1">VO2max (mL/kg/min)</div>
          <HealthChart
            data={points.map(p=>({ day: p.label, vo2_max: p.value }))}
            metric="vo2_max"
            height={220}
            type="line"
            color="#6366f1"
            showTooltip
            showGrid
            rollingWindow={5}
            raColor="#94a3b8"
            xLabel="Date"
            yLabel="VO2max"
          />
        </div>
        {/* metrics summary removed per user request */}
      </div>
    </div>
  );
}
