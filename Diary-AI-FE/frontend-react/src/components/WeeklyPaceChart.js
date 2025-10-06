import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { formatPaceMinPerKm } from '../utils/timeUtils';

/**
 * WeeklyPaceChart
 * Enhanced chart for weekly average pace and optional rolling 4-week pace.
 * Inverts Y axis so that improvement (lower pace) trends upward.
 * Props:
 *  - series: [{ label, weekly (min/km), rolling (min/km) }]
 *  - height: default 200
 *  - showRolling: auto-detect if any rolling values present (can force)
 */
export default function WeeklyPaceChart({ series = [], height = 240 }) {
  const data = useMemo(() => {
    if (!Array.isArray(series)) return [];
    return series.map(r => ({
      week: r.label,
      weekly: r.weekly != null ? Number(r.weekly) : null,
      rolling: r.rolling != null ? Number(r.rolling) : null
    }));
  }, [series]);

  // compute simple linear trend (index -> weekly) and attach into data
  useMemo(() => {
    try {
      const pts = data.map((d, i) => ({ x: i, y: d.weekly })).filter(p => p.y != null && Number.isFinite(p.y));
      if (pts.length < 2) return null;
      const n = pts.length;
      const meanX = pts.reduce((s,p)=>s+p.x,0)/n;
      const meanY = pts.reduce((s,p)=>s+p.y,0)/n;
      let num = 0, den = 0;
      pts.forEach(p => { const dx = p.x - meanX; num += dx*(p.y - meanY); den += dx*dx; });
      const slope = den === 0 ? 0 : num/den;
      const intercept = meanY - slope * meanX;
      for (let i = 0; i < data.length; i++) { data[i].trend = intercept + slope * i; }
    } catch (e) { /* ignore */ }
    return null;
  }, [data]);

  const paceValues = data.flatMap(d => [d.weekly]).filter(v => v != null && !isNaN(v));
  if (!paceValues.length) {
    return <div className="text-xs text-gray-500 px-2 py-6">No pace data available.</div>;
  }
  const min = Math.min(...paceValues);
  const max = Math.max(...paceValues);
  // Add a little padding (pace expressed in min/km, so +/- 0.05 is a few seconds)
  const pad = Math.max(0.03, (max - min) * 0.08);
  const domainTop = min - pad; // smaller number (faster pace) should appear higher, so becomes top boundary
  const domainBottom = max + pad; // slower pace lower

  const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    // find payload entries for weekly and rolling
    const row = payload[0].payload;
    const items = [];
    if (row.weekly != null) items.push({ label: 'Weekly Avg', value: formatPaceMinPerKm(row.weekly) + ' min/km', color: '#0ea5e9' });
    if (row.rolling != null) items.push({ label: 'Rolling Avg', value: formatPaceMinPerKm(row.rolling) + ' min/km', color: '#64748b' });
    if (row.trend != null) items.push({ label: 'Trend', value: formatPaceMinPerKm(row.trend) + ' min/km', color: '#f59e0b' });
    return { title: label, items };
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="week" height={50} interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11 }} label={{ value: 'Week', position: 'insideBottom', offset: -18, style: { fill: '#64748b', fontSize: 11 } }} />
          <YAxis
            domain={[domainBottom, domainTop]} // reversed domain (larger -> bottom)
            tickFormatter={(v) => formatPaceMinPerKm(v)}
            tick={{ fontSize: 11 }}
            label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 11 } }}
          />
          <ReTooltip content={<ChartTooltip mapPayload={mapTooltip} />} />
          <Line type="monotone" dataKey="weekly" name="Weekly Avg" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} connectNulls />
          {/* optional rolling series */}
          {data.some(d => d.rolling != null) && (
            <Line type="monotone" dataKey="rolling" name="Rolling Avg" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="4 4" connectNulls />
          )}
          {/* trend now attached into data as `trend` */}
          {data.some(d => d.trend != null) && (
            <Line type="linear" dataKey="trend" name="Trend" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
          )}
          <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
      {/* footer notes removed per request */}
    </div>
  );
}
