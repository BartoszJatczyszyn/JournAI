import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { format, parseISO } from 'date-fns';

// Helper date formatting
const fmtDay = d => {
  try { return format(parseISO(d), 'MM-dd'); } catch { return d; }
};

export default function RunningTrainingLoadCharts({ runs, height = 220 }) {
  const series = useMemo(()=>{
    if (!Array.isArray(runs)) return [];
    // aggregate distance per day
    const dayMap = new Map();
    runs.forEach(r => {
      if (!r || !r.day || r.distance_km == null) return;
      dayMap.set(r.day, (dayMap.get(r.day) || 0) + Number(r.distance_km));
    });
    const days = Array.from(dayMap.keys()).sort(); // ascending
    // rolling helpers
    function sumWindow(idx, span){
      let total = 0; let count = 0;
      for (let i = Math.max(0, idx-span+1); i <= idx; i++) {
        const d = days[i];
        if (d && dayMap.get(d) != null) { total += dayMap.get(d); count++; }
      }
      return { total, count };
    }
    function statsWindow(idx, span){
      const vals = [];
      for (let i = Math.max(0, idx-span+1); i <= idx; i++) {
        const d = days[i];
        const v = dayMap.get(d);
        if (v != null) vals.push(v);
      }
      if (!vals.length) return { mean:null, sd:null };
      const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
      if (vals.length < 2) return { mean, sd:null };
      const variance = vals.reduce((a,b)=>a + (b-mean)**2,0)/(vals.length-1);
      return { mean, sd: Math.sqrt(variance) };
    }
    return days.map((d, idx) => {
      const acute7 = sumWindow(idx, 7).total; // sum last 7 days (may be <7 early on)
      const chronic28 = sumWindow(idx, 28).total; // sum last 28 days
      const chronicAvg4w = chronic28 / 4; // weekly equivalent for ratio comparability
      const acr = chronicAvg4w > 0 ? acute7 / chronicAvg4w : null; // same logic expected as panel
      const { mean: mean7, sd: sd7 } = statsWindow(idx, 7);
      const monotony = (mean7 != null && sd7 != null && sd7 > 0) ? (mean7 / sd7) : null;
      const strain = (acute7 != null && monotony != null) ? acute7 * monotony : null;
      return { day: d, label: fmtDay(d), acute7: +acute7.toFixed(2), chronic28: +chronic28.toFixed(2), chronicAvg4w: +chronicAvg4w.toFixed(2), acr: acr != null ? +acr.toFixed(3) : null, monotony: monotony != null ? +monotony.toFixed(3) : null, strain: strain != null ? +strain.toFixed(2) : null };
    });
  }, [runs]);

  if (!series.length) return null;

  // Filter to days where at least some distance
  const nonEmpty = series.filter(p => p.acute7 > 0 || p.chronic28 > 0);
  if (!nonEmpty.length) return null;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
  <h3 className="card-title">Training Load Charts</h3>
  <span className="text-[10px] text-gray-500">Acute vs Chronic · ACR</span>
      </div>
      <div className="card-content space-y-8">
        {/* Acute vs Chronic (weekly equivalent) */}
        <div>
          <div className="text-[11px] text-gray-500 mb-1">Acute 7d vs Chronic 28d (weekly equivalent)</div>
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
              <LineChart data={nonEmpty} margin={{ top: 10, right: 30, left: 0, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} label={{ value: 'Day', position: 'insideBottom', offset: -8, style: { fill: '#64748b', fontSize: 11 } }} />
                <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 11 } }} />
                <ReTooltip content={<ChartTooltip mapPayload={({ payload, label }) => {
                  if (!payload || !payload.length) return null;
                  const items = payload.map(p => {
                    const key = p.dataKey;
                    let labelTxt = key === 'acute7' ? 'Acute 7d' : (key === 'chronicAvg4w' ? 'Chronic 4w avg' : key);
                    const val = (p.value != null && !isNaN(Number(p.value))) ? Number(p.value).toFixed(2) + ' km' : '—';
                    const color = p.stroke || p.color || '#64748b';
                    return { label: labelTxt, value: val, color };
                  });
                  return { title: `Day ${label}`, items };
                }} />}
                />
                <Line type="monotone" dataKey="acute7" name="Acute 7d" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="chronicAvg4w" name="Chronic (4w avg)" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* ACR */}
        <div>
          <div className="text-[11px] text-gray-500 mb-1">AC Ratio (Acute / Chronic)</div>
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
              <LineChart data={nonEmpty} margin={{ top: 10, right: 30, left: 0, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} label={{ value: 'Day', position: 'insideBottom', offset: -8, style: { fill: '#64748b', fontSize: 11 } }} />
                <YAxis domain={[0, dataMax => Math.max(2, Math.min(3, Math.ceil(dataMax*1.1)))]} stroke="#64748b" fontSize={11} label={{ value: 'AC Ratio', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 11 } }} />
                <ReTooltip content={<ChartTooltip mapPayload={({ payload, label }) => {
                  if (!payload || !payload.length) return null;
                  const p = payload.find(pl => pl.dataKey === 'acr') || payload[0];
                  const valRaw = p.value;
                  const risk = (() => {
                    if (valRaw == null || isNaN(Number(valRaw))) return null;
                    const v = Number(valRaw);
                    if (v < 0.7) return 'Under-training';
                    if (v < 1.3) return 'Optimal';
                    if (v < 1.5) return 'Elevated';
                    if (v < 2.0) return 'High Risk';
                    return 'Very High';
                  })();
                  const items = [
                    { label: 'AC Ratio', value: valRaw != null ? Number(valRaw).toFixed(2) : '—', color: '#10b981' },
                    risk ? { label: 'Zone', value: risk, color: '#64748b' } : null
                  ].filter(Boolean);
                  return { title: `Day ${label}`, items };
                }} />}
                />
                {/* Optimal band 0.7 - 1.3 could be visually hinted with reference lines */}
                <ReferenceLine y={0.7} stroke="#22c55e" strokeDasharray="4 4" />
                <ReferenceLine y={1.0} stroke="#16a34a" strokeDasharray="2 2" />
                <ReferenceLine y={1.3} stroke="#22c55e" strokeDasharray="4 4" />
                <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="acr" name="ACR" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[10px] text-gray-500 flex flex-wrap gap-3">
            <span><strong>Green lines</strong>: optimal load zone (0.7–1.3)</span>
            <span><strong>Orange / red</strong>: increased overload risk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
