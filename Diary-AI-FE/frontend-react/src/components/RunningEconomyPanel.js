import React, { useMemo, useState } from 'react';
import Tooltip from './Tooltip';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Cell } from 'recharts';
import TooltipStyles from './TooltipStyles';

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
  // Normalize props first (not using hooks yet)
  const safeData = data || {};
  // recommendations removed from UI; keep raw data available in safeData if needed
  // Memoize focus list so subsequent hooks depend on stable reference
  const focus = useMemo(() => (
    Array.isArray(safeData.focus_rankings)
      ? safeData.focus_rankings.filter(f => f && typeof f.metric === 'string')
      : []
  ), [safeData.focus_rankings]);

  // Derive enriched dataset for chart (top absolute correlations)
  const [useAbs, setUseAbs] = useState(true);
  const chartData = useMemo(() => {
    const rows = focus.map(f => ({
      metric: f.metric,
      r: typeof f.r_vs_pace === 'number' ? f.r_vs_pace : null,
      absR: typeof f.r_vs_pace === 'number' ? Math.abs(f.r_vs_pace) : null,
      direction: f.direction || (f.r_vs_pace != null ? (f.r_vs_pace < 0 ? 'inverse' : 'direct') : 'n/a')
    })).filter(d => d.r != null);
    rows.sort((a,b) => (useAbs ? (b.absR - a.absR) : (b.r - a.r)));
    return rows.slice(0,14);
  }, [focus, useAbs]);

  // strongestNegative/strongestPositive removed (summary cards were removed)

  if (!data) return null;

  const formatMetric = (m) => m.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase());
  const strengthLabel = (r) => {
    const a = Math.abs(r);
    if (a >= 0.7) return 'Strong';
    if (a >= 0.5) return 'Moderate';
    if (a >= 0.3) return 'Weak';
    return 'Slight';
  };
  const barColor = (r) => r < 0 ? '#10b981' : '#ef4444';
  const CustomBarTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{formatMetric(p.metric)}</p>
        <p className="tooltip-value"><span className="tooltip-metric">r vs pace:</span><span className="tooltip-number" style={{ color: barColor(p.r) }}>{p.r.toFixed(3)}</span></p>
        <p className="tooltip-value"><span className="tooltip-metric">Strength:</span><span className="tooltip-number">{strengthLabel(p.r)}</span></p>
        <p className="tooltip-value"><span className="tooltip-metric">Direction:</span><span className="tooltip-number">{p.r < 0 ? 'Higher → Faster pace' : 'Higher → Slower pace'}</span></p>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between flex-wrap gap-2">
        <h3 className="card-title flex items-center gap-2">Running Economy <Tooltip content="Correlation of metrics vs avg_pace (min/km). Lower pace = faster run. Negative r means increasing the metric associates with faster pace." /></h3>
        <span className="text-[10px] text-gray-500">Target: {data.target_metric || 'avg_pace'}</span>
      </div>
      <div className="card-content space-y-6">
        <TooltipStyles />
        {/* Summary and recommendations removed per user request */}

        {/* Correlation Bars */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <h4 className="font-semibold text-[11px] uppercase tracking-wide">Correlation Strength ({useAbs ? '|r|' : 'r'} Top {chartData.length})</h4>
            <div className="flex items-center gap-2 text-[10px]">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" checked={useAbs} onChange={e=>setUseAbs(e.target.checked)} />
                Abs
              </label>
            </div>
            <div className="hidden md:flex gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background:'#10b981' }}></span> Beneficial (r {'<'} 0)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background:'#ef4444' }}></span> Detrimental (r {'>'} 0)</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...chartData].reverse()} layout="vertical" margin={{ top: 4, right: 12, left: 60, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[-1,1]} tick={{ fontSize: 11 }} tickFormatter={(v)=>v.toFixed(1)} />
                  <YAxis dataKey="metric" type="category" tick={{ fontSize: 11 }} tickFormatter={(v)=>formatMetric(v).slice(0,18)} width={130} />
                  <ReTooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="r" radius={[4,4,4,4]}>
                    {chartData.slice().reverse().map(d => (
                      <Cell key={d.metric} fill={barColor(d.r)} stroke={barColor(d.r)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-xs text-gray-500">No correlation coefficients available.</div>}
          <div className="mt-3 text-[10px] text-gray-500 leading-snug">
            <p><strong>Interpretation:</strong> Negative correlations indicate that increasing the metric tends to improve pace (faster). Positive correlations suggest higher values are associated with slower pace – consider reducing or optimizing those metrics.</p>
          </div>
        </div>

        {/* Raw Table */}
        <div>
          <h4 className="font-semibold mb-2 text-[11px] uppercase tracking-wide">Detailed Rankings</h4>
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-800/40 bg-slate-950/30">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left border-b border-slate-700/50">
                  <th className="py-1 px-2">Metric</th>
                  <th className="py-1 px-2 text-right">r vs pace</th>
                  <th className="py-1 px-2 text-center">Strength</th>
                  <th className="py-1 px-2 text-center">Direction</th>
                </tr>
              </thead>
              <tbody>
                {focus.slice(0,24).map(f => {
                  const r = f.r_vs_pace;
                  const strength = (typeof r === 'number') ? strengthLabel(r) : '—';
                  const arrow = typeof r === 'number' ? (r < 0 ? '▲' : '▼') : '';
                  return (
                    <tr key={f.metric} className="border-b last:border-0 border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                      <td className="py-1 px-2 font-mono text-[10px] whitespace-nowrap">{f.metric}</td>
                      <td className="py-1 px-2 text-right tabular-nums font-medium" style={{ color: typeof r==='number'? barColor(r): undefined }}>{typeof r==='number'? r.toFixed(3): '—'}</td>
                      <td className="py-1 px-2 text-center text-[10px] flex items-center justify-center gap-1">{arrow && <span className={r<0?'text-emerald-500':'text-rose-500'}>{arrow}</span>}{strength}</td>
                      <td className="py-1 px-2 text-center">{f.direction}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Local styles (tooltip mimic Sleep page) */}
      <style jsx>{`
        :global(.custom-tooltip) {
          background: var(--glass-bg, rgba(15,23,42,0.95));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          padding: 10px 12px;
          border-radius: 10px;
          min-width: 160px;
        }
        :global(.custom-tooltip .tooltip-label) { margin: 0 0 6px 0; font-weight: 600; font-size: 0.75rem; color: #0f172a; }
        :global(.dark .custom-tooltip .tooltip-label) { color: #f1f5f9; }
        :global(.custom-tooltip .tooltip-value) { margin: 0 0 4px 0; display: flex; justify-content: space-between; gap: 12px; font-size: 0.70rem; }
        :global(.custom-tooltip .tooltip-metric) { color: #64748b; }
        :global(.dark .custom-tooltip .tooltip-metric) { color: #94a3b8; }
        :global(.custom-tooltip .tooltip-number) { font-weight: 600; color: #0ea5e9; }
      `}</style>
    </div>
  );
}
