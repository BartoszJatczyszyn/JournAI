import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ReferenceLine, ReferenceArea } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { formatPaceMinPerKm, parsePaceToMinutes } from '../utils/timeUtils';
import METRIC_UNITS from '../utils/metricsUnits';

/**
 * PaceHrChart
 * Plots avg_pace (min/km) together with avg_hr and max_hr (bpm).
 * - runs: array of run objects (server or client) containing date-like field and the metrics
 * - height: chart height
 */
export default function PaceHrChart({
  runs = [],
  height = 420,
  primaryMetric = 'avg_pace',
  showHrZones = true,
  showAvgLines = true,
  distanceDotScale = true,
  showTrendLines = true,
  showAvgHr = true,
  showMaxHr = true,
}) {
  const data = useMemo(() => {
    if (!Array.isArray(runs)) return [];
    const out = runs
      .map(r => {
        // try common date fields
        const label = r.day || r.start_time || r.date || r.label || null;
  const dayObj = label ? new Date(label) : null;
        // pace: allow various names and formats
        const rawPace = r.avg_pace ?? r.avgPace ?? r.avg_pace_min ?? r.pace ?? null;
        const pace = rawPace != null ? parsePaceToMinutes(rawPace) : (r.rollingAvgPace4 ?? null);
        // Heart rate fields (bpm) — prefer avg_hr / max_hr but accept HR fallbacks if present
        const avgHr = r.avg_hr ?? r.avgHR ?? r.avg_heart_rate ?? r.avg_hr ?? r.avgHR ?? null;
        const maxHr = r.max_hr ?? r.maxHR ?? r.max_heart_rate ?? r.max_hr ?? r.maxHR ?? null;
        // distance in km (used optionally for point sizing)
        let distanceKm = null;
        try {
          if (r.distance_km != null) distanceKm = Number(r.distance_km);
          else if (r.total_distance_km != null) distanceKm = Number(r.total_distance_km);
          else if (r.distance != null) {
            const dNum = Number(r.distance);
            // Heuristic: if value looks like meters (> 1000) convert to km
            distanceKm = dNum > 100 ? dNum / 1000.0 : dNum;
          }
          if (!Number.isFinite(distanceKm)) distanceKm = null;
        } catch (e) {
          distanceKm = null;
        }
        return {
          label: dayObj ? dayObj.toISOString().slice(0,10) : (label || ''),
          // store numeric timestamp so XAxis can be a numeric time scale
          dayObj: dayObj ? dayObj.getTime() : null,
          avg_pace: pace != null && Number.isFinite(pace) ? Number(pace) : null,
          distance_km: distanceKm,
          // compute avg_steps_per_min if provided or derivable from steps/duration
          avg_steps_per_min: (() => {
            const rawStepsMin = r.avg_steps_per_min ?? r.avgStepsPerMin ?? r.steps_per_min ?? null;
            if (rawStepsMin != null && Number.isFinite(Number(rawStepsMin))) return Number(rawStepsMin);
            const steps = r.steps ?? r.total_steps ?? r.step_count ?? null;
            const durMin = r.duration_min ?? r.duration ?? r.moving_time ?? r.elapsed_time ?? null;
            if (steps != null && durMin != null && Number.isFinite(Number(steps)) && Number.isFinite(Number(durMin)) && Number(durMin) > 0) {
              return Number(steps) / Number(durMin);
            }
            return null;
          })(),
          avg_hr: avgHr != null && Number.isFinite(Number(avgHr)) ? Number(avgHr) : null,
          max_hr: maxHr != null && Number.isFinite(Number(maxHr)) ? Number(maxHr) : null
        };
        })
    // keep rows that have at least one of the plotted metrics
  .filter(d => d.avg_pace != null || d.avg_hr != null || d.max_hr != null || d.avg_steps_per_min != null)
      // sort chronological — support dayObj as either a Date or a numeric timestamp
      .sort((a,b) => {
        const getTs = (v) => {
          if (v == null) return 0;
          if (typeof v === 'number') return v;
          if (typeof v.getTime === 'function') return v.getTime();
          // fallback: try converting to number
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const ta = getTs(a.dayObj);
        const tb = getTs(b.dayObj);
        return ta - tb;
      });
    // re-index after sorting for tooltip delta calculations
    out.forEach((d,i)=>{ d._i = i; });
    return out;
  }, [runs]);

  // Debug logging to help verify primaryMetric prop and data contents at runtime
  try {
    if (typeof window !== 'undefined' && window && window.console && process && process.env && process.env.NODE_ENV !== 'production') {
      // Print only a compact sample to avoid noisy logs
      const sample = data.slice(0, 6).map(d => ({ label: d.label, avg_pace: d.avg_pace, avg_steps_per_min: d.avg_steps_per_min, avg_hr: d.avg_hr }));
      // eslint-disable-next-line no-console
      console.debug('PaceHrChart debug — primaryMetric:', primaryMetric, 'data sample:', sample);
    }
  } catch (e) {
    // ignore logging errors
  }

  // compute simple linear trends (index -> value) for each series
  const trends = useMemo(() => {
    if (!showTrendLines) return {};
    const series = ['avg_pace','avg_hr','max_hr','avg_steps_per_min'];
    const out = {};
    series.forEach(key => {
      const pts = data.map((d,i) => ({ x: i, y: d[key] })).filter(p => p.y != null && Number.isFinite(p.y));
      if (pts.length < 2) { out[key] = null; return; }
      const n = pts.length;
      const meanX = pts.reduce((s,p)=>s+p.x,0)/n;
      const meanY = pts.reduce((s,p)=>s+p.y,0)/n;
      let num=0, den=0; pts.forEach(p=>{ const dx = p.x-meanX; num += dx*(p.y-meanY); den += dx*dx; });
      const slope = den===0?0:num/den; const intercept = meanY - slope*meanX;
      out[key] = data.map((d,i) => ({ label: d.label, dayObj: d.dayObj, value: intercept + slope * i }));
    });
    return out;
  }, [data, showTrendLines]);

  // pace domain (min/km) - we want smaller (faster) to appear higher -> reverse domain
  const paceValues = data.map(d => d.avg_pace).filter(v => v != null);
  const stepsPerMinValues = data.map(d => d.avg_steps_per_min).filter(v => v != null);
  const hrValues = data.flatMap(d => [d.avg_hr, d.max_hr]).filter(v => v != null);
  const paceMin = paceValues.length ? Math.min(...paceValues) : null;
  const paceMax = paceValues.length ? Math.max(...paceValues) : null;
  const padP = 0.05; // 3 seconds
  // If no pace values, use a reasonable default visible window (4:00..7:00)
  if (paceMin == null || paceMax == null) {
    const defaultLow = 4.0; // 4:00 min/km
    const defaultHigh = 7.0; // 7:00 min/km
    const padDyn = padP;
    var paceDomain = [defaultHigh + padDyn, Math.max(0, defaultLow - padDyn)];
  } else {
    // dynamic padding for pace (avoid clipping when small variance)
    const rawRange = Math.max(0, paceMax - paceMin);
    const minRange = 0.75; // ensure at least ~45 seconds visible range
    const effectiveRange = Math.max(rawRange, minRange);
    const center = (paceMax + paceMin) / 2;
    const half = effectiveRange / 2;
    const displayMin = Math.max(0, center - half);
    const displayMax = center + half;
    const padDyn = Math.max(padP, (displayMax - displayMin) * 0.08);
    paceDomain = [displayMax + padDyn, Math.max(0, displayMin - padDyn)]; // reversed so smaller = faster at top
  }

  // Generate ticks for the pace axis so tick marks align to sensible pace steps (15s = 0.25 min)
  const paceTickStep = 0.25; // 15 seconds
  let paceTicks = undefined;
  try {
    const pmin = Math.min(...paceDomain);
    const pmax = Math.max(...paceDomain);
    const start = Math.floor(pmin / paceTickStep) * paceTickStep;
    const end = Math.ceil(pmax / paceTickStep) * paceTickStep;
    const ticks = [];
    for (let v = start; v <= end + 1e-9; v = +(v + paceTickStep).toFixed(8)) ticks.push(Number(v));
    paceTicks = ticks;
  } catch (e) {
    // fallback: leave undefined so Recharts chooses
    paceTicks = undefined;
  }

  const hrMin = hrValues.length ? Math.min(...hrValues) : 40;
  const hrMax = hrValues.length ? Math.max(...hrValues) : 160;
  const hrPad = Math.max(3, Math.round((hrMax - hrMin) * 0.08));
  const hrDomain = [Math.max(0, hrMin - hrPad), hrMax + hrPad];

    const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
  const row = payload[0].payload;
    const items = [];
    // Actual values
  if (row.avg_pace != null) items.push({ label: 'Avg Pace', value: (formatPaceMinPerKm(row.avg_pace) || row.avg_pace.toFixed(2)) + ` ${METRIC_UNITS.avg_pace || 'min/km'}`, color: '#0ea5e9' });
  if (row.avg_steps_per_min != null) items.push({ label: 'Steps / min', value: `${row.avg_steps_per_min.toFixed(1)} spm`, color: '#0ea5e9' });
    if (row.avg_hr != null) items.push({ label: 'Avg HR', value: `${row.avg_hr.toFixed(0)} ${METRIC_UNITS.avg_hr || 'bpm'}`, color: '#10b981' });
    if (row.max_hr != null) items.push({ label: 'Max HR', value: `${row.max_hr.toFixed(0)} ${METRIC_UNITS.max_hr || 'bpm'}`, color: '#ef4444' });
    if (row.distance_km != null) items.push({ label: 'Distance', value: `${row.distance_km.toFixed(2)} km`, color: '#6366f1' });

    // Delta vs previous point (pace & avg HR)
    if (row._i != null && row._i > 0) {
      const prev = data[row._i - 1];
      if (prev) {
        if (row.avg_pace != null && prev.avg_pace != null) {
          const delta = row.avg_pace - prev.avg_pace; // positive = slower
            const deltaLabel = (delta === 0) ? '±0s' : (delta > 0 ? '+' : '') + Math.round(delta * 60) + 's';
          items.push({ label: 'Δ Pace', value: deltaLabel, color: '#0284c7' });
        }
        if (row.avg_hr != null && prev.avg_hr != null) {
          const deltaHr = row.avg_hr - prev.avg_hr;
          const deltaHrLabel = (deltaHr === 0) ? '±0' : (deltaHr > 0 ? '+' : '') + deltaHr.toFixed(0);
          items.push({ label: 'Δ Avg HR', value: `${deltaHrLabel} bpm`, color: '#059669' });
        }
      }
    }

    // Trend values — Recharts includes the trend series in the tooltip payload; find them by name
    const findByName = (name) => payload.find(p => p.name === name);
    const paceTrend = findByName('Pace Trend');
    if (paceTrend && Number.isFinite(Number(paceTrend.value))) {
      items.push({ label: 'Pace Trend', value: `${formatPaceMinPerKm(Number(paceTrend.value))} min/km`, color: paceTrend.color || '#f59e0b' });
    }
    const avgHrTrend = findByName('Avg HR Trend');
    if (avgHrTrend && Number.isFinite(Number(avgHrTrend.value))) {
      items.push({ label: 'Avg HR Trend', value: `${Number(avgHrTrend.value).toFixed(0)} bpm`, color: avgHrTrend.color || '#10b981' });
    }
    const maxHrTrend = findByName('Max HR Trend');
    if (maxHrTrend && Number.isFinite(Number(maxHrTrend.value))) {
      items.push({ label: 'Max HR Trend', value: `${Number(maxHrTrend.value).toFixed(0)} bpm`, color: maxHrTrend.color || '#ef4444' });
    }

    // Prefer an explicit date label from the row (YYYY-MM-DD), fall back to numeric label
    const title = row?.label || (row?.dayObj ? new Date(row.dayObj).toISOString().slice(0,10) : String(label));
    return { title, items };
  };


  // Averages for reference lines
  const avgPace = useMemo(() => {
    const vals = data.map(d=>d.avg_pace).filter(v=>v!=null && Number.isFinite(v));
    if (!vals.length) return null; return vals.reduce((a,b)=>a+b,0)/vals.length;
  }, [data]);
  const avgHrVal = useMemo(() => {
    const vals = data.map(d=>d.avg_hr).filter(v=>v!=null && Number.isFinite(v));
    if (!vals.length) return null; return vals.reduce((a,b)=>a+b,0)/vals.length;
  }, [data]);
  const avgMaxHrVal = useMemo(() => {
    const vals = data.map(d=>d.max_hr).filter(v=>v!=null && Number.isFinite(v));
    if (!vals.length) return null; return vals.reduce((a,b)=>a+b,0)/vals.length;
  }, [data]);

  // HR zone background areas (percent of observed max)
  const hrZones = useMemo(() => {
    if (!showHrZones || !hrValues.length) return [];
    const observedMax = Math.max(...hrValues);
    const maxRef = observedMax || 190;
    const zones = [
      { from: 0.5, to: 0.6, color: '#dcfce7' }, // Z1
      { from: 0.6, to: 0.7, color: '#bbf7d0' }, // Z2
      { from: 0.7, to: 0.8, color: '#fde68a' }, // Z3
      { from: 0.8, to: 0.9, color: '#fecaca' }, // Z4
      { from: 0.9, to: 1.01, color: '#fee2e2' }, // Z5
    ];
    return zones.map(z => ({ y1: z.from * maxRef, y2: z.to * maxRef, color: z.color }));
  }, [showHrZones, hrValues]);

  // Dynamic dot sizing based on distance (sqrt scale) for primary metric series
  const dotRenderer = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    let r = 3;
    if (distanceDotScale && payload?.distance_km != null) {
      const d = Math.max(0, payload.distance_km);
      r = Math.min(9, 3 + Math.sqrt(d)); // 5km -> ~5.2, 25km -> 8
    }
    return (<circle cx={cx} cy={cy} r={r} fill="#0ea5e9" stroke="#fff" strokeWidth={1} />);
  };

  return (
    <div style={{ width: '100%', height }}>
      {!data.length && (
        <div className="text-xs text-gray-500 px-2 py-6">No pace/HR data available.</div>
      )}
      {data.length > 0 && (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {/* use numeric time axis so newer dates appear on the right and spacing reflects time */}
          <XAxis
            dataKey="dayObj"
            type="number"
            domain={["dataMin", "dataMax"]}
            height={48}
            tickFormatter={(v) => (v ? new Date(v).toISOString().slice(0,10) : '')}
            interval={0}
            angle={-25}
            textAnchor="end"
            tick={{ fontSize: 11 }}
          />
          <YAxis yAxisId="hr" domain={hrDomain} tick={{ fontSize: 11 }} label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: '#64748b', fontSize: 11 } }} />
          {/* HR Zones background */}
          {hrZones.map((z, idx) => (
            <ReferenceArea key={idx} yAxisId="hr" y1={z.y1} y2={z.y2} strokeOpacity={0} fill={z.color} fillOpacity={0.35} />
          ))}
          {primaryMetric === 'avg_pace' ? (
            <YAxis yAxisId="pace" orientation="right" domain={paceDomain} ticks={paceTicks} tickFormatter={(v) => formatPaceMinPerKm(v)} tick={{ fontSize: 11 }} label={{ value: 'Avg Pace (min/km)', angle: -90, position: 'insideRight', offset: 18, style: { fill: '#64748b', fontSize: 11 } }} />
          ) : (
            (() => {
              const vals = stepsPerMinValues.length ? stepsPerMinValues : [0, 10];
              const minV = Math.max(0, Math.floor(Math.min(...vals) - 1));
              const maxV = Math.ceil(Math.max(...vals) + 1);
              return (
                <YAxis yAxisId="pace" orientation="right" domain={[minV, maxV]} tick={{ fontSize: 11 }} label={{ value: 'Steps / min', angle: -90, position: 'insideRight', offset: 18, style: { fill: '#64748b', fontSize: 11 } }} />
              );
            })()
          )}
          <ReTooltip content={<ChartTooltip mapPayload={mapTooltip} />} />
          {primaryMetric === 'avg_pace' ? (
            <Line yAxisId="pace" type="monotone" dataKey="avg_pace" name="Avg Pace" stroke="#0ea5e9" strokeWidth={3} dot={dotRenderer} connectNulls />
          ) : (
            <Line yAxisId="pace" type="monotone" dataKey="avg_steps_per_min" name="Steps / min" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3 }} connectNulls />
          )}
          {showAvgHr && (
            <Line yAxisId="hr" type="monotone" dataKey="avg_hr" name="Avg HR" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          )}
          {showMaxHr && (
            <Line yAxisId="hr" type="monotone" dataKey="max_hr" name="Max HR" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          )}
          {/* Trend overlays (dashed) */}
          {trends.avg_pace && primaryMetric === 'avg_pace' && (
            <Line
              yAxisId="pace"
              type="linear"
              data={trends.avg_pace}
              dataKey="value"
              name="Pace Trend"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="12 6"
                strokeOpacity={0.95}
                strokeLinecap="round"
              dot={false}
            />
          )}
          {primaryMetric !== 'avg_pace' && trends.avg_steps_per_min && (
            <Line
              yAxisId="pace"
              type="linear"
              data={trends.avg_steps_per_min}
              dataKey="value"
              name="Steps Trend"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="12 6"
              strokeOpacity={0.95}
              strokeLinecap="round"
              dot={false}
            />
          )}
          {showAvgHr && trends.avg_hr && (
            <Line
              yAxisId="hr"
              type="linear"
              data={trends.avg_hr}
              dataKey="value"
              name="Avg HR Trend"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="12 6"
              strokeOpacity={0.9}
              strokeLinecap="round"
              dot={false}
            />
          )}
          {showMaxHr && trends.max_hr && (
            <Line
              yAxisId="hr"
              type="linear"
              data={trends.max_hr}
              dataKey="value"
              name="Max HR Trend"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="12 6"
              strokeOpacity={0.9}
              strokeLinecap="round"
              dot={false}
            />
          )}
          {/* Average reference lines */}
          {showAvgLines && avgPace != null && primaryMetric === 'avg_pace' && (
            <ReferenceLine yAxisId="pace" y={avgPace} stroke="#0ea5e9" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Avg ${formatPaceMinPerKm(avgPace)}/km`, position: 'right', fill: '#0ea5e9', fontSize: 10 }} />
          )}
          {showAvgLines && avgHrVal != null && (
            <ReferenceLine yAxisId="hr" y={avgHrVal} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.2} ifOverflow="extendDomain" label={{ value: `Avg HR ${avgHrVal.toFixed(0)}`, position: 'left', fill: '#10b981', fontSize: 10 }} />
          )}
          {showAvgLines && avgMaxHrVal != null && (
            <ReferenceLine yAxisId="hr" y={avgMaxHrVal} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.2} ifOverflow="extendDomain" label={{ value: `Avg Max HR ${avgMaxHrVal.toFixed(0)}`, position: 'left', fill: '#ef4444', fontSize: 10 }} />
          )}
          <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
