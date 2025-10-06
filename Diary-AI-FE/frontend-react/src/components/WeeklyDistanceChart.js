import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, Tooltip as ReTooltip, ReferenceLine, Cell } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';

/**
 * WeeklyDistanceChart
 * Enhanced replacement for the minimal Weeks Distance sparkline.
 * Props:
 *  - series: [{ label (week string), value (km number) }]
 *  - height: chart height (default 180)
 *  - rollingWindow: window length for rolling avg line (default 4)
 */
export default function WeeklyDistanceChart({ series = [], height = 220, rollingWindow = 4 }) {
  const data = useMemo(() => {
    if (!Array.isArray(series)) return [];
    // compute rolling avg (window based on array order)
    const out = series.map((d, i) => {
      const slice = series.slice(Math.max(0, i - rollingWindow + 1), i + 1);
      const avg = slice.reduce((s, r) => s + (Number(r.value) || 0), 0) / slice.length;
      return { week: d.label, distance: Number(d.value) || 0, ra: +avg.toFixed(2) };
    });
    return out;
  }, [series, rollingWindow]);

  const maxDistance = useMemo(() => data.reduce((m, d) => Math.max(m, d.distance), 0), [data]);
  const minDistance = useMemo(() => data.reduce((m, d) => Math.min(m, d.distance), Infinity), [data]);
  const medianDistance = useMemo(() => {
    const arr = data.map(d => d.distance).slice().sort((a,b)=>a-b);
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
  }, [data]);
  // dynamic vertical padding to avoid clipping: 10-15% of range, with a minimum
  const yPadding = useMemo(() => {
    const min = Number.isFinite(minDistance) ? minDistance : 0;
    const max = Number.isFinite(maxDistance) ? maxDistance : 0;
    const range = Math.max(0, max - min);
    return Math.max(0.5, range * 0.12);
  }, [minDistance, maxDistance]);
  const meanDistance = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((s,d)=>s+d.distance,0)/data.length;
  }, [data]);
  // linear regression trend (index -> distance)
  const trendSeries = useMemo(() => {
    if (!data.length) return [];
    const xs = data.map((_, i) => i);
    const ys = data.map(d => d.distance || 0);
    const n = xs.length;
    const meanX = xs.reduce((s,x)=>s+x,0)/n;
    const meanY = ys.reduce((s,y)=>s+y,0)/n;
    let num = 0, den = 0;
    for (let i=0;i<n;i++) { const dx = xs[i]-meanX; num += dx*(ys[i]-meanY); den += dx*dx; }
    const slope = den === 0 ? 0 : num/den;
    const intercept = meanY - slope*meanX;
    return data.map((d, i) => ({ ...d, trend: intercept + slope * i }));
  }, [data]);
  const aboveColor = '#0ea5e9';
  const belowColor = '#94d2ff';
  const meanColor = '#f59e0b';

  if (!data.length) {
    return <div className="text-xs text-gray-500 px-2 py-6">No weekly distance data.</div>;
  }

  const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    const row = payload[0].payload;
    const items = [];
    const distP = payload.find(p => p.dataKey === 'distance');
    if (distP) items.push({ label: 'Distance', value: (distP.value != null ? Number(distP.value).toFixed(2) : '—') + ' km', color: distP.fill || distP.color || '#0ea5e9' });
    const raP = payload.find(p => p.dataKey === 'ra');
    if (raP) items.push({ label: `Rolling ${rollingWindow}w Avg`, value: (raP.value != null ? Number(raP.value).toFixed(2) : '—') + ' km', color: raP.stroke || '#64748b' });
    // % deviation vs rolling average
    if (row && typeof row.distance === 'number' && typeof row.ra === 'number' && row.ra > 0) {
      const pct = ((row.distance - row.ra) / row.ra) * 100;
      items.push({ label: 'Δ vs RA', value: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', color: pct >= 0 ? aboveColor : belowColor });
    }
    return { title: row.week || label, items };
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="week" height={50} interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11 }} label={{ value: 'Week', position: 'insideBottom', offset: -18, style: { fill: '#64748b', fontSize: 11 } }} />
          <YAxis domain={[dataMin => (dataMin - yPadding), dataMax => (dataMax + yPadding)]} tick={{ fontSize: 11 }} label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 11 } }} />
          <ReTooltip content={<ChartTooltip mapPayload={mapTooltip} />} />
          {/* Reference line at max week for quick visual anchor */}
          {maxDistance > 0 && (
            <ReferenceLine y={maxDistance} stroke="#0ea5e9" strokeDasharray="4 4" label={{ value: 'Max', position: 'right', fill: '#0ea5e9', fontSize: 10 }} />
          )}
          {medianDistance > 0 && (
            <ReferenceLine y={medianDistance} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Median', position: 'right', fill: '#64748b', fontSize: 10 }} />
          )}
          {meanDistance > 0 && (
            <ReferenceLine y={meanDistance} stroke={meanColor} strokeDasharray="6 2" label={{ value: 'Mean', position: 'right', fill: meanColor, fontSize: 10 }} />
          )}
          <Bar dataKey="distance" name="Distance" radius={[4,4,0,0]}>
            {data.map(d => (
              <Cell key={d.week} fill={d.distance >= d.ra ? aboveColor : belowColor} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="ra" name={`Rolling ${rollingWindow}w Avg`} stroke="#64748b" strokeWidth={2} dot={false} />
          {/* Trend line (linear fit) */}
          <Line
            type="linear"
            data={trendSeries}
            dataKey="trend"
            name="Trend"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* footer legend removed per user request */}
    </div>
  );
}
