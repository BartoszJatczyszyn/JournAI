import React from 'react';
import Tooltip from './Tooltip';

/*
 Displays running economy insights from backend running_analysis.running_economy
 Props:
   data: {
     focus_rankings: [ { metric, r_vs_pace, direction } ],
     recommendations: [string],
     target_metric: 'avg_pace'
   }
*/
export default function RunningEconomyPanel({ data }) {
  if (!data) return null;
  const recs = data.recommendations || [];
  const focus = data.focus_rankings || [];
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between flex-wrap gap-2">
  <h3 className="card-title flex items-center gap-2">Running Economy <Tooltip content="Metric correlations versus pace (min/km). Lower pace = faster run." /></h3>
  <span className="text-[10px] text-gray-500">Target: avg_pace</span>
      </div>
      <div className="card-content space-y-4 text-xs">
        <div>
          <h4 className="font-semibold mb-1 text-[11px] uppercase tracking-wide">Recommendations</h4>
          {recs.length ? (
            <ul className="list-disc ml-5 space-y-1">
              {recs.map((r,i)=><li key={i}>{r}</li>)}
            </ul>
          ) : <div className="text-gray-500">No recommendations.</div>}
        </div>
        <div>
          <h4 className="font-semibold mb-1 text-[11px] uppercase tracking-wide">Strongest correlations (|r|)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left border-b border-gray-700/50">
                  <th className="py-1 pr-2">Metric</th>
                  <th className="py-1 pr-2 text-right">r vs pace</th>
                  <th className="py-1 pr-2 text-center">Direction</th>
                </tr>
              </thead>
              <tbody>
                {focus.slice(0,12).map(f => (
                  <tr key={f.metric} className="border-b last:border-0 border-gray-800/40">
                    <td className="py-1 pr-2 font-mono text-[10px]">{f.metric}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{f.r_vs_pace != null ? f.r_vs_pace.toFixed(3) : '—'}</td>
                    <td className="py-1 pr-2 text-center">{f.direction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-gray-500 leading-snug">
            <p><strong>Interpretation:</strong> Negative r means a higher metric value is associated with faster pace (lower min/km) – a potential improvement direction. Positive r for load-related metrics (HR, ground contact, vertical osc) suggests reducing them may improve pace.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
