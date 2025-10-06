import React from 'react';
import Tooltip from './Tooltip';
import { formatPaceMinPerKm } from '../utils/timeUtils';

/**
 * Displays pace form metrics derived from backend running_analysis.pace_form
 * Expects object like:
 * { pace_mean_all, pace_std_all, recent_mean_pace_7d, baseline_mean_pace_30d, recent_vs_baseline_delta_pct, current_pace_z, current_form_score }
 */
export default function RunningPaceFormPanel({ data }) {
  // This panel now only shows summary metrics; charts moved to separate component.
  if (!data) return null;
  // If backend returned only sample count or an error, show a clear message
  if (data.samples && (!data.pace_mean_all && !data.recent_mean_pace_7d && !data.current_pace_z)) {
    return (
      <div className="card h-full">
        <div className="card-header"><h3 className="card-title">Pace Form</h3></div>
        <div className="card-content text-xs text-gray-500">Insufficient pace data to compute form ({data.samples} samples).</div>
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="card h-full">
        <div className="card-header"><h3 className="card-title">Pace Form</h3></div>
        <div className="card-content text-xs text-gray-500">No pace data available ({data.error}).</div>
      </div>
    );
  }
  const rows = [
    { k: 'All Mean Pace', v: data.pace_mean_all, fmt: v => v != null ? `${formatPaceMinPerKm(v)}` : '—', tip: 'Average pace (avg_pace) for entire period.' },
    { k: 'All Std Dev', v: data.pace_std_all, fmt: v => v != null ? `${formatPaceMinPerKm(v)}` : '—', tip: 'Pace standard deviation (minutes → mm:ss).' },
    { k: 'Recent 7d', v: data.recent_mean_pace_7d, fmt: v => v != null ? `${formatPaceMinPerKm(v)}` : '—', tip: 'Average pace last 7 days.' },
    { k: 'Baseline 30d', v: data.baseline_mean_pace_30d, fmt: v => v != null ? `${formatPaceMinPerKm(v)}` : '—', tip: '30-day baseline average pace.' },
    { k: 'Δ Recent vs Baseline', v: data.recent_vs_baseline_delta_pct, fmt: v => v != null ? (v>0?'+':'')+v.toFixed(2)+'%' : '—', tip: 'Positive = faster vs 30-day baseline.' },
    { k: 'Current Pace Z', v: data.current_pace_z, fmt: v => v != null ? v.toFixed(2) : '—', tip: 'Current pace z-score (negative = faster than mean).' },
    { k: 'Form Score', v: data.current_form_score, fmt: v => v != null ? v.toFixed(2) : '—', tip: 'Inverted z-score (higher = better current form).' },
  ];
  // Build timeseries for charts (pace + form / z-score) using provided runs (ascending) if available
  // moved hook definitions above
  return (
    <div className="card h-full">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Pace Form</h3>
        <span className="text-[10px] text-gray-500">Summary</span>
      </div>
      <div className="card-content text-sm">
        <table className="w-full text-xs">
          <tbody>
            {rows.map(r => (
              <tr key={r.k} className="border-b last:border-0 border-gray-700/40">
                <td className="py-1 pr-2 font-medium flex items-center gap-1">{r.k}{r.tip && <Tooltip content={r.tip} />}</td>
                <td className="py-1 text-right tabular-nums">{r.fmt(r.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
