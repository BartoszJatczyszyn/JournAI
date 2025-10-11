import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { getSleepScoreColor } from '../utils/chartUtils';
import ChartTooltip from './ui/ChartTooltip';

const formatBinLabel = (i, resolution) => {
  const minutes = i * resolution;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const median = (arr) => {
  if (!arr || arr.length === 0) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

// use shared getSleepScoreColor to ensure palette consistency

const SleepHistogram = ({
  timeseries = [],
  metric = 'bedtime_minutes',
  color = '#0ea5e9',
  height = 240,
  resolutionMinutes = 30, // 15, 30, 60
  daysLimit = 14,
  avgMinutes14 = null, // optional minutes-of-day average to mark on chart
}) => {
  const { data, totalDays } = useMemo(() => {
    const res = Math.max(1, Math.min(60, Math.round(resolutionMinutes)));
    const binCount = Math.floor(1440 / res);
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: i,
      label: formatBinLabel(i, res),
      count: 0,
      scores: [],
      medianScore: null,
    }));

    // Take only last 14 days (by day desc)
    const source = Array.isArray(timeseries) ? [...timeseries] : [];
    source.sort((a, b) => (a?.day > b?.day ? -1 : 1));
    const recent = source.slice(0, Math.max(1, daysLimit || 14));

    let validDays = 0;
    recent.forEach(d => {
      const m = d?.[metric];
      if (m != null && !isNaN(m)) {
        validDays += 1;
        try {
          const minutes = Math.round(Number(m));
          const mm = ((minutes % 1440) + 1440) % 1440;
          const idx = Math.floor(mm / res);
          if (bins[idx]) {
            bins[idx].count = (bins[idx].count || 0) + 1;
            // push possible score if present (some timeseries include sleep_score)
            if (d.sleep_score != null && !isNaN(d.sleep_score)) bins[idx].scores.push(Number(d.sleep_score));
          }
        } catch (e) {
          // ignore malformed entries
        }
      }
    });

    // compute median score per bin
    bins.forEach(b => { if (b.scores && b.scores.length) b.medianScore = median(b.scores); });

    // Determine minimal circular arc covering active bins, and expand by ±1 hour
    const binsPerHour = Math.max(1, Math.round(60 / res));
    const activeIdx = bins.map((b, i) => (b.count > 0 ? i : -1)).filter(i => i >= 0);

    let dataWindow = [];
    let start = 0;
    let end = Math.min(bins.length - 1, 2 * binsPerHour);

    if (activeIdx.length > 0) {
      const sortedIdx = [...activeIdx].sort((a, b) => a - b);
      // find largest gap between consecutive active bins (circular)
      let maxGap = -1;
      let maxGapAt = -1;
      for (let i = 0; i < sortedIdx.length; i++) {
        const cur = sortedIdx[i];
        const next = sortedIdx[(i + 1) % sortedIdx.length];
        const gap = (next - cur + binCount) % binCount;
        if (gap > maxGap) {
          maxGap = gap;
          maxGapAt = i;
        }
      }
      const arcStart = sortedIdx[(maxGapAt + 1) % sortedIdx.length]; // start after largest gap
      const arcLen = binCount - maxGap; // shortest arc length covering all active bins
      const arcEnd = (arcStart + arcLen - 1) % binCount;

      // pad by ±1 hour
      start = (arcStart - binsPerHour + binCount) % binCount;
      end = (arcEnd + binsPerHour) % binCount;

      // build rotated window from start..end (inclusive) in circular order
      const seq = [start];
      while (seq[seq.length - 1] !== end) {
        seq.push((seq[seq.length - 1] + 1) % binCount);
      }
      dataWindow = seq.map(idx => ({
        ...bins[idx],
        label: formatBinLabel(idx, res),
        percent: validDays > 0 ? +(bins[idx].count * 100 / validDays).toFixed(1) : 0,
      }));
    } else {
      // No active bins, default small window from 00:00
      const seq = [];
      for (let i = start; ; i = (i + 1) % binCount) {
        seq.push(i);
        if (i === end) break;
      }
      dataWindow = seq.map(idx => ({
        ...bins[idx],
        label: formatBinLabel(idx, res),
        percent: 0,
      }));
    }

    return { data: dataWindow, totalDays: validDays, filteredRange: [start, end] };
  }, [timeseries, metric, resolutionMinutes, daysLimit]);

  

  const mapTooltip = ({ payload }) => {
    if (!payload || !payload.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    const items = [
      { label: 'Days', value: p.count },
      { label: 'Percent', value: `${p.percent}%` },
    ];
    if (p.medianScore != null) items.push({ label: 'Median score', value: Math.round(p.medianScore) });
    return { title: p.label, items };
  };

  const CustomTooltip = (props) => <ChartTooltip {...props} mapPayload={mapTooltip} />;

  // legacy tooltip removed

  // Build tick labels aligned to full hours within the cropped window
  const tickLabels = useMemo(() => {
    const hours = new Set();
    const out = [];
    for (const d of data) {
      if (!d?.label) continue;
      const [hh, mm] = d.label.split(':');
      if (mm === '00' && !hours.has(hh)) {
        hours.add(hh);
        out.push(d.label);
      }
    }
    // Fallback to some spacing if there are too few hour labels
    if (out.length < 2) {
      const step = Math.max(1, Math.round(60 / Math.max(1, Math.min(60, Math.round(resolutionMinutes)))));
      for (let i = 0; i < data.length; i += step) out.push(data[i].label);
    }
    return out;
  }, [data, resolutionMinutes]);

  return (
    <div className="sleep-histogram">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          {/* Draw 14-day average marker if provided */}
          {avgMinutes14 != null && (() => {
            try {
              const res = Math.max(1, Math.min(60, Math.round(resolutionMinutes)));
              const binIdx = Math.floor(((Math.round(Number(avgMinutes14)) % 1440) + 1440) % 1440 / res);
              const found = data.find(d => d.bin === binIdx);
              if (found) {
                const label = found.label;
                return (
                  <ReferenceLine x={label} stroke="#111827" strokeDasharray="4 3" label={{ value: `14d avg ${label}`, position: 'top', fill: '#111827', fontSize: 12 }} />
                );
              }
            } catch (e) {
              // ignore
            }
            return null;
          })()}
          <XAxis dataKey="label" ticks={tickLabels} interval={0} stroke="#64748b" fontSize={12} angle={-45} height={60} />
          <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
          <ReTooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4,4,0,0]}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.count > 0 ? getSleepScoreColor(entry.medianScore, color) : '#e5e7eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary / average info below chart */}
      <div className="histogram-summary">
        {avgMinutes14 != null ? (
          <div className="avg-line">
            <strong>14-day average {metric === 'wake_minutes' ? 'wake time' : 'bedtime'}:</strong>
            <span className="avg-value"> {(() => {
              try {
                const m = Math.round(Number(avgMinutes14));
                const mm = ((m % 1440) + 1440) % 1440;
                const hh = Math.floor(mm / 60);
                const mins = mm % 60;
                return ` ${String(hh).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
              } catch (e) { return ' N/A'; }
            })()}</span>
            <span className="avg-meta"> &nbsp;({totalDays || 0} days used)</span>
          </div>
        ) : (
          <div className="avg-line"><em>14-day average not available</em></div>
        )}
      </div>

      <style jsx>{`
        /* tooltip styling unified in src/index.css */
      `}</style>
    </div>
  );
};

export default SleepHistogram;
