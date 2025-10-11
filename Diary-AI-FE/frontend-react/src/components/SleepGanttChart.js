import React, { useMemo } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ComposedChart, Line } from 'recharts';
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
    // Signed rotation: values before base become negative (left of base), values after base positive.
    const rot = (m) => {
      const mm = norm(m);
      let r = ((mm - base) % 1440 + 1440) % 1440; // 0..1439
      if (r > 720) r -= 1440; // map to (-720..720]
      return r;
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

  // rotate to base (signed): pre-base values will be negative, post-base positive
  let rStart = rot(bed);
  // compute segment length robustly from raw minutes-of-day delta
  const rawSeg = ((wake - bed + 1440) % 1440);
  const seg = Math.max(0, rawSeg);
  // compute end as start + seg to preserve continuity
  

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
      data[i].wakeTrend = wakeMin != null ? (data[i].bedTrend != null ? data[i].bedTrend + ((wakeMin - bedMin + 1440) % 1440) : rot(wakeMin)) : null;
    }

    return data;
  }, [timeseries, maxDays, base]);

  const chartHeight = height || Math.max(220, rows.length * rowHeight + 80);

  // Compute domain to fit window on rotated axis (0..1440+ depending on rotation)
  // Behavior:
  // - If fitWindow is true (default) the domain will be computed from the earliest rotated
  //   sleep start to the latest rotated sleep end across rows, with a small padding.
  // - If fitWindow is false, domainMinutes (if provided) defines the span starting at 0.
  const computedDomain = useMemo(() => {
    const defaultSpan = (domainMinutes && domainMinutes > 0) ? Math.min(domainMinutes, 1440) : 600;
    if (!rows.length) return { min: -defaultSpan/2, max: defaultSpan/2, span: defaultSpan };
    if (!fitWindow) return { min: -defaultSpan/2, max: defaultSpan/2, span: defaultSpan };
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const r of rows) {
      const s = (r.bedR != null) ? r.bedR : 0;
      const e = (r.wakeR != null) ? r.wakeR : (s + (r.segR || 0));
      minStart = Math.min(minStart, s);
      maxEnd = Math.max(maxEnd, e);
    }
    const rawSpan = Math.max(60, maxEnd - minStart);
    const pad = Math.max(20, Math.min(120, Math.round(rawSpan * 0.08)));
    const min = Math.floor(minStart - pad);
    const max = Math.ceil(maxEnd + pad);
    return { min, max, span: Math.max(60, max - min) };
  }, [rows, fitWindow, domainMinutes]);

  // X axis label formatter: rotate back to clock time and indicate next-day values when needed
  const formatXAxis = (val) => {
    const absolute = base + Number(val || 0);
    const wrapped = ((Math.round(absolute) % 1440) + 1440) % 1440;
    return minutesToHHmm(wrapped);
  };

  // Create ticks that nicely span the domain: choose an interval that yields ~5-8 ticks
  const ticks = useMemo(() => {
    const out = [];
    const start = computedDomain.min;
    const end = computedDomain.max;
    const span = Math.max(1, end - start);
    const desiredTicks = 6;
    // interval in minutes rounded to nearest 15/30/60 boundary for readability
    const rawInterval = Math.ceil(span / desiredTicks);
    const roundTo = (n) => {
      if (n <= 30) return 15;
      if (n <= 60) return 30;
      if (n <= 120) return 60;
      if (n <= 240) return 120;
      return 180;
    };
    const interval = Math.max(15, Math.ceil(rawInterval / roundTo(rawInterval)) * roundTo(rawInterval));
    let t = Math.floor(start / interval) * interval;
    // ensure first tick is within domain
    if (t < start) t += interval;
    for (; t <= end; t += interval) out.push(t);
    // fallback: ensure at least start and end ticks
    if (!out.length) {
      out.push(start);
      out.push(end);
    } else {
      if (out[0] > start) out.unshift(Math.floor(start));
      if (out[out.length - 1] < end) out.push(Math.ceil(end));
    }
    return out;
  }, [computedDomain]);

  // Map original rows into display coordinates that fall inside computedDomain.
  // This wraps values by adding/subtracting 1440 as needed so items display near each other
  const displayRows = useMemo(() => {
    if (!rows || !rows.length) return [];
    const out = rows.map(r => ({ ...r }));
    const min = computedDomain.min;
    const max = computedDomain.max;
    for (const r of out) {
      // normalize offsetR, bedR, wakeR, trends into [min, max] by adding/subtracting 1440
      ['offsetR','bedR','wakeR','bedTrend','wakeTrend'].forEach(key => {
        if (r[key] == null) return;
        // bring into a value near the center of domain
        while (r[key] < min) r[key] += 1440;
        while (r[key] > max) r[key] -= 1440;
      });
      // ensure wake is after bed (handle wrap)
      if (r.wakeR != null && r.bedR != null && r.wakeR <= r.bedR) {
        r.wakeR = r.bedR + (r.segR || 0);
      }
    }
    return out;
  }, [rows, computedDomain]);

  const chartData = (displayRows && displayRows.length) ? displayRows : rows;

  const CustomTooltip = ({ active, payload, _label }) => {
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
  <ComposedChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[computedDomain.min, computedDomain.max]} ticks={ticks} tickFormatter={formatXAxis} stroke="#64748b" fontSize={12} />
          <YAxis type="category" dataKey="dateLabel" stroke="#64748b" fontSize={12} width={110} />
          <Tooltip content={<CustomTooltip />} />
          {/* Single continuous segment per sleep on rotated axis */}
          <Bar dataKey="offsetR" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="segR" stackId="a" radius={[6,6,6,6]} minPointSize={4}>
            {chartData.map((entry, index) => (
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
        /* Tooltip visuals unified in src/index.css — component keeps only small layout/color overrides below */
        :global(.sleep-gantt-chart .tooltip-number) { font-weight: 600; color: ${barColor}; }
        :global(.sleep-gantt-chart .tooltip-extra) { color: #ffffff; margin-top: 6px; font-size: 0.85rem; }
        /* Recharts may render the tooltip outside this component; ensure extra text is readable */
        :global(.recharts-tooltip-wrapper .custom-tooltip .tooltip-extra),
        :global(.recharts-default-tooltip .custom-tooltip .tooltip-extra) {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
};

export default SleepGanttChart;