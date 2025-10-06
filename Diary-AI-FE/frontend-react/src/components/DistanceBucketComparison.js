import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, BarChart, Bar, ReferenceLine } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { parsePaceToMinutes, paceMinPerKm, durationToMinutes, formatPaceMinPerKm } from '../utils/timeUtils';

/**
 * DistanceBucketComparison
 * Groups runs into distance buckets (center ± tolerance) for common race-like distances.
 * Visualizes: pace timeline per bucket and bucket pace summary (avg / median).
 *
 * NOTE: Correlation matrix removed in this build. Previously used Pearson r on overlapping sequences.
 */
export default function DistanceBucketComparison({
  activities = [],
  // Which sport to consider (affects filtering and messaging). Default kept as 'running' for backwards compatibility.
  sport = 'running',
  // Backwards compatibility: if bucketCenters passed, convert to config with ±1 tolerance.
  bucketCenters,
  bucketsConfig
}) {
  const [showBucketManager, setShowBucketManager] = useState(false);
  const [customBuckets, setCustomBuckets] = useState(() => {
    try {
      const raw = localStorage.getItem('distanceBucketCustom');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(b => b && typeof b.center === 'number').map(b => ({
            label: b.label || `~${b.center}k`,
            center: Number(b.center),
            tol: b.tol != null ? Number(b.tol) : (b.tolerance != null ? Number(b.tolerance) : 1)
          }));
        }
      }
    } catch (e) { /* ignore */ }
    return [];
  });
  const [newCenter, setNewCenter] = useState('');
  const [newTol, setNewTol] = useState('1');
  const [newLabel, setNewLabel] = useState('');
  const [bucketError, setBucketError] = useState('');
  const [assignMode, setAssignMode] = useState(() => {
    try {
      const v = localStorage.getItem('distanceBucketAssignMode');
      if (v === 'all' || v === 'nearest') return v;
    } catch(e) { /* ignore storage read error */ }
    return 'nearest';
  });
  // UI improvements for readability
  const [showTrend, setShowTrend] = useState(() => {
    try { return localStorage.getItem('distanceBucketShowTrend') !== 'false'; } catch(e){ return true; }
  });
  // Removed smoothing/order/points toggles -> defaults applied (points always on, no smoothing, newest on right)
  const showPoints = true; // always show points now

  React.useEffect(() => {
    try { localStorage.setItem('distanceBucketAssignMode', assignMode); } catch(e) { /* ignore storage write error */ }
  }, [assignMode]);
  React.useEffect(()=>{ try { localStorage.setItem('distanceBucketShowTrend', String(showTrend)); } catch(e){ /* ignore */ } }, [showTrend]);
  // Removed persistence for smoothing/points/order (controls no longer in UI)

  // Which bucket to show on the pace timeline ('All' shows all series)
  const [selectedBucket, setSelectedBucket] = useState(() => {
    try { return localStorage.getItem('distanceBucketSelected') || 'All'; } catch (e) { return 'All'; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('distanceBucketSelected', selectedBucket); } catch (e) { /* ignore */ }
  }, [selectedBucket]);

  // Persist custom buckets
  React.useEffect(() => {
    try { localStorage.setItem('distanceBucketCustom', JSON.stringify(customBuckets)); } catch (e) { /* ignore */ }
  }, [customBuckets]);

  // Default bucket configuration now includes Half Marathon (HM) 21.1 km and Marathon with tolerances.
  const effectiveBuckets = useMemo(() => {
    if (Array.isArray(bucketsConfig) && bucketsConfig.length) return bucketsConfig.map(b => ({
      label: b.label ?? `~${b.center}k`,
      center: Number(b.center),
      tol: b.tol != null ? Number(b.tol) : (b.tolerance != null ? Number(b.tolerance) : 1)
    }));
    if (Array.isArray(bucketCenters) && bucketCenters.length) return bucketCenters.map(c => ({ label: `~${c}k`, center: Number(c), tol: 1 }));
    const defaults = [
      { label: '~5k', center: 5, tol: 1 },
      { label: '~10k', center: 10, tol: 1 },
      { label: '~15k', center: 15, tol: 1 },
      { label: '~20k', center: 20, tol: 1 },
  { label: 'HM', center: 21.1, tol: 0.7 }, // Half Marathon bucket (21.1 ±0.7 => covers ~20.4–21.8)
  { label: '~25k', center: 25, tol: 1 },
  { label: 'Marathon', center: 42.2, tol: 0.8 }, // Marathon bucket
    ];
    // Merge defaults + custom (avoid near-duplicate centers within combined tolerance window).
    const merged = [...defaults];
    customBuckets.forEach(cb => {
      const dup = merged.find(d => Math.abs(d.center - cb.center) <= Math.max(d.tol, cb.tol));
      if (!dup) merged.push(cb);
    });
    return merged;
  }, [bucketsConfig, bucketCenters, customBuckets]);

  // Map runs to matching bucket(s) according to assignMode (nearest or all)
  const buckets = useMemo(() => {
    const byKey = {};
    effectiveBuckets.forEach(b => { byKey[b.label] = { cfg: b, runs: [] }; });
    const runs = (activities || []).filter(a => (a.sport || '').toLowerCase() === (sport || 'running').toLowerCase());
    runs.forEach(a => {
      const dist = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : null);
      if (!(dist > 0)) return;
      // collect candidate buckets within tolerance
      const candidates = effectiveBuckets
        .filter(b => Math.abs(dist - b.center) <= b.tol)
        .map(b => ({ b, delta: Math.abs(dist - b.center) }));
      if (!candidates.length) return;
      if (assignMode === 'all') {
        candidates.forEach(c => byKey[c.b.label].runs.push(a));
      } else {
        candidates.sort((x,y)=> x.delta - y.delta);
        const target = candidates[0].b; // nearest center
        byKey[target.label].runs.push(a);
      }
    });
  // sort each bucket chronologically
    Object.values(byKey).forEach(entry => entry.runs.sort((a,b)=> new Date(a.start_time) - new Date(b.start_time)));
    return byKey;
  }, [activities, effectiveBuckets, assignMode, sport]);

  // Stats & series per bucket
  const bucketStats = useMemo(() => {
    return effectiveBuckets.map(cfg => {
      const list = buckets[cfg.label]?.runs || [];
      const paces = [];
      const series = [];
      list.forEach(a => {
        const dist = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : null);
        const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
        let pace = rawPace != null ? parsePaceToMinutes(rawPace) : null;
        if (pace == null) {
          const dur = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
          pace = paceMinPerKm(dist, dur);
        }
        if (pace != null && Number.isFinite(pace) && pace > 0) {
          paces.push(pace);
          series.push({
            date: a.start_time ? new Date(a.start_time).toISOString().slice(0,10) : '—',
            pace,
            distance: dist
          });
        }
      });
      paces.sort((a,b)=>a-b);
      const median = paces.length ? (paces.length % 2 ? paces[(paces.length-1)/2] : (paces[paces.length/2-1] + paces[paces.length/2]) / 2) : null;
      const avg = paces.length ? paces.reduce((s,v)=>s+v,0)/paces.length : null;
      const avgDist = series.length ? series.reduce((s,v)=>s+(v.distance||0),0)/series.length : null;
      return { label: cfg.label, center: cfg.center, tol: cfg.tol, count: series.length, paces, series, avgPace: avg, medianPace: median, avgDist };
    });
  }, [buckets, effectiveBuckets]);

  // Timeline merged by date
  const lineChartData = useMemo(() => {
    const dateSet = new Set();
    bucketStats.forEach(b => b.series.forEach(r => dateSet.add(r.date)));
  // Always ascending (old -> new); newest on right.
  let dates = Array.from(dateSet).sort();
    const maxPoints = 80; // safeguard for visual density
    const used = dates.length > maxPoints ? dates.slice(-maxPoints) : dates;
    const base = used.map(d => {
      const row = { date: d };
      bucketStats.forEach(bs => {
        const found = bs.series.find(r => r.date === d);
        row[`pace_${bs.label}`] = found ? found.pace : null;
      });
      return row;
    });
    return base;
  }, [bucketStats]);


  const barData = useMemo(() => bucketStats.map(bs => ({
    bucket: bs.label,
    avgPace: bs.avgPace,
    medianPace: bs.medianPace,
    count: bs.count
  })), [bucketStats]);

  const colors = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6'];
  const colorFor = (label, i) => colors[i % colors.length];
  // Format date labels on X axis (expecting YYYY-MM-DD)
  const formatDateLabel = (d) => {
    if (!d) return '';
    // show DD.MM or fallback
    if (typeof d === 'string' && d.length >= 10 && d.includes('-')) {
      const parts = d.split('-');
      const day = parts[2];
      const m = parts[1];
      return `${day}.${m}`; // e.g. 05.10
    }
    return d;
  };

  const mapLineTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    // Derive base date (ISO) from label or first payload row
    let isoDate = (typeof label === 'string' && label.includes('-')) ? label : (payload[0]?.payload?.date || '');
    // Fallback: if still empty, do not render tooltip
    if (!isoDate) return null;
    let weekdayShort = '';
    let shortDate = isoDate;
    try {
      const dObj = new Date(isoDate);
      if (!isNaN(dObj.getTime())) {
        weekdayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dObj.getUTCDay()];
        const parts = isoDate.split('-');
        if (parts.length === 3) shortDate = `${parts[2]}.${parts[1]}`;
      }
    } catch(e) { /* ignore parse errors */ }
    const dateItemValue = `${weekdayShort ? weekdayShort + ' ' : ''}${shortDate}`;
    const seriesItems = payload.map(p => ({ label: p.dataKey.replace('pace_',''), value: p.value != null ? formatPaceMinPerKm(p.value)+' min/km' : '—', color: p.color }));
    const items = dateItemValue.trim() ? [{ label: 'Date', value: dateItemValue, color: '#94a3b8' }, ...seriesItems] : seriesItems;
    return { title: isoDate, items };
  };
  const mapBarTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    const row = payload[0].payload;
    return { title: label, items: [
      { label: 'Avg Pace', value: row.avgPace!=null? formatPaceMinPerKm(row.avgPace)+' min/km':'—', color:'#0ea5e9' },
      { label: 'Median Pace', value: row.medianPace!=null? formatPaceMinPerKm(row.medianPace)+' min/km':'—', color:'#6366f1' },
  { label: 'Run count', value: row.count, color:'#f59e0b' }
    ]};
  };

  const anyData = bucketStats.some(b => b.count > 0);
  const pluralMap = { running: 'runs', walking: 'walks', cycling: 'rides' };
  const plural = pluralMap[(sport || 'running').toLowerCase()] || ((sport || 'activities') + 's');
  if (!anyData) return <div className="text-xs text-gray-500">No {plural} found in the default buckets (5,10,15,20,21.1,25,42.2 km).</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4 text-[11px] items-center">
        <button type="button" className="btn btn-xs" onClick={()=>setShowBucketManager(s=>!s)}>{showBucketManager ? 'Hide buckets' : 'Manage buckets'}</button>
        <div className="flex items-center gap-1">
          <label className="text-gray-400">Assignment:</label>
          <select className="select select-xs" value={assignMode} onChange={e=>setAssignMode(e.target.value)}>
            <option value="nearest">Nearest</option>
            <option value="all">All matching</option>
          </select>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1 text-gray-400">
            <input type="checkbox" className="checkbox checkbox-xs" checked={showTrend} onChange={e=>setShowTrend(e.target.checked)} /> Trend
          </label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-gray-400">Show:</label>
          {/* primary quick-select buckets (persisted) */}
          {['All','~5k','~10k','~15k','~20k','HM','Marathon'].map(b => (
            <button key={b} type="button" className={`btn btn-ghost btn-xs ${selectedBucket===b? 'btn-active':''}`} onClick={()=>setSelectedBucket(b)}>{b}</button>
          ))}
        </div>
      </div>
      {showBucketManager && (
        <div className="p-3 rounded-md border border-slate-700/60 bg-slate-800/40 space-y-3 text-[11px]">
          <div className="font-semibold text-gray-200">Custom distance buckets</div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block mb-1 text-gray-400 uppercase tracking-wide">Center (km)</label>
              <input type="number" min={0.5} step={0.1} value={newCenter} onChange={e=>setNewCenter(e.target.value)} className="input input-sm w-full" placeholder="e.g. 12" />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1 text-gray-400 uppercase tracking-wide">Tolerance ± km</label>
              <input type="number" min={0.1} step={0.1} value={newTol} onChange={e=>setNewTol(e.target.value)} className="input input-sm w-full" placeholder="e.g. 1" />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1 text-gray-400 uppercase tracking-wide">Label (optional)</label>
              <input type="text" value={newLabel} onChange={e=>setNewLabel(e.target.value)} className="input input-sm w-full" placeholder="e.g. ~12k" />
            </div>
            <div className="md:col-span-6 flex gap-2">
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => {
                    setBucketError('');
                    const c = Number(newCenter);
                    const t = Number(newTol);
                    if (!(c > 0)) { setBucketError('Invalid center'); return; }
                    if (!(t > 0)) { setBucketError('Invalid tolerance'); return; }
                    if (c > 500) { setBucketError('Center value too large'); return; }
                    // Check duplicates against effective (defaults + existing custom) BEFORE adding
                    const dup = effectiveBuckets.find(b => Math.abs(b.center - c) <= Math.max(b.tol, t));
                    if (dup) { setBucketError(`Conflict with existing bucket: ${dup.label}`); return; }
                    const label = newLabel.trim() || (c === 21.1 ? 'HM+' : `~${c}k`);
                    setCustomBuckets(arr => [...arr, { label, center: c, tol: t }]);
                    setNewCenter(''); setNewTol('1'); setNewLabel('');
                  }}
                >Add</button>
                {bucketError && <div className="text-rose-400 text-[11px]">{bucketError}</div>}
            </div>
          </div>
          {customBuckets.length > 0 ? (
            <div className="space-y-2">
              <div className="text-gray-400">Your buckets:</div>
              <div className="flex flex-wrap gap-2">
                {customBuckets.map((b,i)=>(
                  <div key={i} className="px-2 py-1 rounded-md bg-slate-700/60 flex items-center gap-2">
                    <span className="font-mono">{b.label}</span>
                    <span className="text-gray-400">{b.center}±{b.tol}</span>
                    <button type="button" className="text-rose-400 hover:text-rose-300 text-xs" onClick={()=>setCustomBuckets(arr=>arr.filter((_,idx)=>idx!==i))} aria-label={`Remove ${b.label}`}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-xs btn-outline" onClick={()=>setCustomBuckets([])}>Clear custom</button>
            </div>
          ) : <div className="text-gray-500">No custom buckets.</div>}
          <div className="text-[10px] text-gray-500">Custom buckets will not duplicate existing ones (conflict detection uses distance ≤ max tolerance).</div>
        </div>
      )}
      <div>
        <h4 className="font-semibold mb-1">Pace timeline</h4>
        <div className="text-[10px] text-gray-500 mb-2 flex flex-wrap gap-x-3 gap-y-1">
          <span>Pace (min/km) — lower line = faster.</span>
          {showTrend && <span>Orange dashed = linear trend.</span>}
          <span>Dots mark actual run days.</span>
        </div>
        {lineChartData.length > 0 && (
          <div style={{ width:'100%', height:300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top:10, right:24, left:8, bottom:30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  angle={-25}
                  textAnchor="end"
                  tick={{ fontSize:11 }}
                  tickFormatter={formatDateLabel}
                  minTickGap={8}
                  height={55}
                  label={{
                    value: 'Date (training day)',
                    position: 'insideBottomRight',
                    offset: -5,
                    style: { fill: '#64748b', fontSize: 11 }
                  }}
                />
                <YAxis tickFormatter={(v)=>formatPaceMinPerKm(v)} tick={{ fontSize:11 }} label={{ value:'Pace (min/km)', angle:-90, position:'insideLeft', style:{ fill:'#64748b', fontSize:11 } }} />
                <ReTooltip content={<ChartTooltip mapPayload={mapLineTooltip} />} />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize:11 }} />
                {bucketStats.map((bs,i)=>{
                  const key = `pace_${bs.label}`;
                  // if a bucket is selected, only render that series (or all when selectedBucket==='All')
                  if (selectedBucket !== 'All' && selectedBucket !== bs.label) return null;
                  // compute simple trend for this series from lineChartData
                  const vals = lineChartData.map(r => r[key]);
                  let trend = null;
                  try {
                    const pts = vals.map((v, idx) => ({ x: idx, y: v })).filter(p => p.y != null && Number.isFinite(p.y));
                    if (pts.length >= 2) {
                      const n = pts.length;
                      const meanX = pts.reduce((s,p)=>s+p.x,0)/n;
                      const meanY = pts.reduce((s,p)=>s+p.y,0)/n;
                      let num=0, den=0; pts.forEach(p=>{ const dx = p.x-meanX; num += dx*(p.y-meanY); den += dx*dx; });
                      const slope = den===0?0:num/den; const intercept = meanY - slope*meanX;
                      trend = lineChartData.map((_, idx) => ({ [`${key}`]: intercept + slope * idx }));
                    }
                  } catch(e) { trend = null; }
                  // emphasis handled via strokeWidth & opacity directly
                  return (
                      <React.Fragment key={bs.label}>
                      <Line
                        key={`l-${bs.label}`}
                        type="monotone"
                        dataKey={key}
                        name={bs.label}
                        stroke={colorFor(bs.label,i)}
                        strokeWidth={selectedBucket === bs.label ? 3 : 2}
                        strokeOpacity={selectedBucket === 'All' ? 0.9 : (selectedBucket === bs.label ? 1 : 0.35)}
                        dot={showPoints ? { r: 3, strokeWidth: 1, stroke: colorFor(bs.label,i), fill: '#0f172a' } : false}
                        activeDot={showPoints ? { r: 5 } : false}
                        connectNulls
                        isAnimationActive={false}
                      />
                      {showTrend && trend && (
                        <Line key={`t-${bs.label}`} data={trend} type="linear" dataKey={key} stroke="#f59e0b" strokeWidth={1.4} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                      )}
                    </React.Fragment>
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {selectedBucket !== 'All' && bucketStats.find(bs=>bs.label===selectedBucket)?.count === 0 && (
          <div className="text-xs text-gray-500 mt-2">No {plural} found for selected bucket: {selectedBucket}.</div>
        )}
        {lineChartData.length === 0 && <div className="text-xs text-gray-500">No timeline data.</div>}
      </div>
      <div>
        <h4 className="font-semibold mb-2">Pace summary</h4>
        <div style={{ width:'100%', height:300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top:10, right:24, left:8, bottom:30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="bucket" tick={{ fontSize:11 }} />
              <YAxis tickFormatter={(v)=>formatPaceMinPerKm(v)} tick={{ fontSize:11 }} domain={[dataMin => (dataMin - 0.5), dataMax => (dataMax + 0.5)]} label={{ value:'Pace (min/km)', angle:-90, position:'insideLeft', style:{ fill:'#64748b', fontSize:11 } }} />
              <ReTooltip content={<ChartTooltip mapPayload={mapBarTooltip} />} />
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize:11 }} />
              <ReferenceLine y={0} stroke="#334155" />
              <Bar dataKey="avgPace" name="Avg Pace" fill="#0ea5e9" radius={[4,4,0,0]} />
              <Bar dataKey="medianPace" name="Median Pace" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-gray-500 mt-2">Lower bars = faster pace. Counts: {bucketStats.map(b=>`${b.label}:${b.count}`).join(' · ')}</div>
      </div>
    </div>
  );
}
