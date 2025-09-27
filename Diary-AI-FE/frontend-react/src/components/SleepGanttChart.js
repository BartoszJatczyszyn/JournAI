import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList, ComposedChart, Line } from 'recharts';
import { circularEWMASeries } from '../utils/timeUtils';
import { getSleepScoreColor } from '../utils/chartUtils';

const minutesToHHmm = (m) => {
  if (m == null || isNaN(m)) return 'N/A';
  const raw = Math.round(Number(m));
  const mm = ((raw % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60) % 24;
  const min = mm % 60;
  return `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
};

const parseOffset = (offset) => {
  if (typeof offset === 'number') return Math.max(0, Math.min(1439, Math.floor(offset)));
  // expect HH:mm
  try {
    const [hh, mm] = String(offset).split(':').map(x => parseInt(x, 10));
    const m = (hh % 24) * 60 + (mm % 60);
    return Math.max(0, Math.min(1439, m));
  } catch {
    return 23 * 60; // default 23:00
  }
};

const SleepGanttChart = ({
  timeseries = [],
  offset = '22:00', // base rotation reference time (HH:mm) used for clock labels (start of X axis)
  maxDays = 14,
  rowHeight = 28,
  barColor = '#0ea5e9',
  domainMinutes = null, // if null and fitWindow=true, auto-fit to data window
  height, // optional; if not set, computed from rows
  fitWindow = true, // auto-fit X domain to min(start) .. max(end) across rows
}) => {
  // Rotation base: left edge of the chart (e.g., 22:00)
  const base = useMemo(() => parseOffset(offset), [offset]);
  // Build rows with a single continuous segment per sleep using rotated minutes relative to base
  const rows = useMemo(() => {
    const data = [];
    const sorted = Array.isArray(timeseries) ? [...timeseries] : [];
    sorted.sort((a, b) => new Date(a?.day) - new Date(b?.day));
    const sliced = sorted.slice(-Math.max(1, maxDays));

    const norm = (m) => ((Math.round(Number(m)) % 1440) + 1440) % 1440;
    const rot = (m) => {
      // rotate m to base; 0 means 'offset' (base), 60 -> base+1h, etc.
      const mm = norm(m);
      return ((mm - base) % 1440 + 1440) % 1440;
    };

  for (const d of sliced) {
      if (d == null) continue;
      let bed = d.bedtime_minutes;
      let wake = d.wake_minutes;
      if (bed == null && d.sleep_start) {
        try {
          const dt = new Date(d.sleep_start);
          bed = dt.getHours() * 60 + dt.getMinutes();
        } catch (e) {
          // ignore malformed dates
        }
      }
      if (wake == null && d.sleep_end) {
        try {
          const dt = new Date(d.sleep_end);
          wake = dt.getHours() * 60 + dt.getMinutes();
        } catch (e) {
          // ignore malformed dates
        }
      }
      if (bed == null || wake == null || isNaN(bed) || isNaN(wake)) continue;
      bed = norm(bed);
      wake = norm(wake);

      // rotate to base so that intervals crossing midnight become continuous
      let rStart = rot(bed);
      let rEnd = rot(wake);
      if (rEnd <= rStart) rEnd += 1440; // ensure continuous segment after rotation
      const seg = Math.max(0, rEnd - rStart);

      const score = typeof d.sleep_score === 'number' ? d.sleep_score : null;
      const dayObj = (d.day && typeof d.day === 'string') ? new Date(d.day) : (d.day?.toDate ? d.day.toDate() : null);
      const dow = dayObj ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayObj.getDay()] : '';

      data.push({
        day: d.day,
        dateLabel: dow || d.day,
        offsetR: rStart,
        segR: seg,
        bedR: rStart,
        wakeR: rStart + seg,
        bedHHMM: minutesToHHmm(bed),
        wakeHHMM: minutesToHHmm(wake),
        durationHHMM: `${Math.floor((seg) / 60)}h ${(seg % 60)}m`,
        sleep_score: score,
      });
    }
    // compute circular EWMA trends on original minutes-of-day and map to rotated coords
    const origBed = sliced.map(d => d.bedtime_minutes != null ? ((Math.round(Number(d.bedtime_minutes)) % 1440) + 1440) % 1440 : null);
    const origWake = sliced.map(d => d.wake_minutes != null ? ((Math.round(Number(d.wake_minutes)) % 1440) + 1440) % 1440 : null);
    const bedE = circularEWMASeries(origBed, 0.18); // minutes-of-day per index
    const wakeE = circularEWMASeries(origWake, 0.18);
    for (let i = 0; i < data.length; i++) {
      const bedMin = bedE[i];
      const wakeMin = wakeE[i];
      // map to rotated coordinates
      data[i].bedTrend = bedMin != null ? rot(bedMin) : null;
      data[i].wakeTrend = wakeMin != null ? (rot(wakeMin) + (rot(wakeMin) <= data[i].bedR ? 1440 : 0)) : null;
    }

    return data;
  }, [timeseries, maxDays, base]);

  const chartHeight = height || Math.max(220, rows.length * rowHeight + 80);

  // Compute domain to fit window on rotated axis (0..1440+ depending on rotation)
  const computedDomain = useMemo(() => {
    const defaultSpan = (domainMinutes && domainMinutes > 0) ? Math.min(domainMinutes, 1440) : 600;
    if (!rows.length) {
      return { min: 0, max: defaultSpan, span: defaultSpan };
    }
    if (!fitWindow) {
      return { min: 0, max: defaultSpan, span: defaultSpan };
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const r of rows) {
      const s = (r.offsetR != null) ? r.offsetR : 0;
      const e = (r.offsetR != null) ? r.offsetR + (r.segR || 0) : 0;
      minStart = Math.min(minStart, s);
      maxEnd = Math.max(maxEnd, e);
    }
    const pad = 60; // dynamic -1h / +1h padding
    let min = minStart - pad; // allow going before earliest sleep start
    let max = maxEnd + pad;   // allow going after latest sleep end
    if (max <= min) max = min + 60;
    const span = Math.max(60, max - min);
    return { min, max, span };
  }, [rows, fitWindow, domainMinutes]);

  // X axis label formatter: rotate back to clock time
  const formatXAxis = (val) => minutesToHHmm(base + val);
  const ticks = useMemo(() => {
    const out = [];
    const start = computedDomain.min;
    const end = computedDomain.max;
    for (let t = Math.floor(start / 60) * 60; t <= end; t += 60) out.push(t);
    return out;
  }, [computedDomain]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{p.day}</p>
          <p className="tooltip-value"><span className="tooltip-metric">Sleep:</span> <span className="tooltip-number">{p.bedHHMM} → {p.wakeHHMM}</span></p>
          <p className="tooltip-extra" style={{ color: '#ffffff' }}>Duration: {p.durationHHMM}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="sleep-gantt-chart">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={rows} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[computedDomain.min, computedDomain.max]} ticks={ticks} tickFormatter={formatXAxis} stroke="#64748b" fontSize={12} />
          <YAxis type="category" dataKey="dateLabel" stroke="#64748b" fontSize={12} width={110} />
          <Tooltip content={<CustomTooltip />} />
          {/* Single continuous segment per sleep on rotated axis */}
          <Bar dataKey="offsetR" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="segR" stackId="a" radius={[6,6,6,6]} minPointSize={4}>
            {rows.map((entry, index) => (
              <Cell key={`cellR-${index}`} fill={entry.sleep_score == null ? barColor : getSleepScoreColor(entry.sleep_score, barColor)} />
            ))}
            <LabelList
              dataKey="sleep_score"
              position="inside"
              formatter={(v) => (typeof v === 'number' ? `${Math.round(v)}` : '')}
              style={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
          {/* Trend lines for bedtime and wake (14-day rolling average) */}
          <Line type="monotone" dataKey="bedTrend" stroke="#7c3aed" strokeWidth={2} dot={false} legendType="line" />
          <Line type="monotone" dataKey="wakeTrend" stroke="#06b6d4" strokeWidth={2} dot={false} legendType="line" />
        </ComposedChart>
      </ResponsiveContainer>

      <style jsx>{`
        :global(.sleep-gantt-chart .custom-tooltip) {
          /* glassmorphism */
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          
          
          
          
          
          
        }
        
        :global(.sleep-gantt-chart .tooltip-label) {
          color: var(--text-primary);
           font-weight: 600; margin: 0 0 8px 0; }
        :global(.sleep-gantt-chart .tooltip-metric) {
          color: var(--text-muted);
           color: #64748b; }
        :global(.dark .sleep-gantt-chart .tooltip-metric) { color: #94a3b8; }
  :global(.sleep-gantt-chart .tooltip-number) { font-weight: 600; color: ${barColor}; }
  :global(.sleep-gantt-chart .tooltip-extra) { color: #ffffff; margin-top: 6px; font-size: 0.85rem; }
  /* Recharts may render the tooltip outside this component; target common wrapper and force color */
  :global(.recharts-tooltip-wrapper .custom-tooltip .tooltip-extra),
  :global(.recharts-default-tooltip .custom-tooltip .tooltip-extra) {
    color: #ffffff !important;
  }
      `}</style>
    </div>
  );
};

export default SleepGanttChart;