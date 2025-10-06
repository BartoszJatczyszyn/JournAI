import React, { useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import MetricCard from '../components/MetricCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Cell, Legend, AreaChart, Area, ComposedChart } from 'recharts';
import CorrelationMatrix from '../components/CorrelationMatrix';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import SleepHistogram from '../components/SleepHistogram';
import SleepTimingAnalysis from '../components/SleepTimingAnalysis';
import SleepQualityZones from '../components/sleep/SleepQualityZones';
// timeUtils helpers were previously imported but are unused in this file
import { getSleepScoreColor } from '../utils/chartUtils';
import { useSleepAnalysis } from '../hooks/useSleepAnalysis';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const formatHrsToHhMm = (hours) => {
    if (hours == null || isNaN(hours)) return 'N/A';
    const h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) { m = 0; return `${h + 1}h`; }
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatMinsToHhMm = (mins) => {
    if (mins == null || isNaN(mins)) return 'N/A';
    const total = Math.round(mins);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const rows = payload.map(p => {
    const name = p.name || p.dataKey || 'value';
    const val = p.value != null ? p.value : 'N/A';
    const color = p.color || p.fill || p.stroke || '#64748b';
    const unitHint = /\(h\)/i.test(String(name)) ? 'hours' : (/min|minutes/i.test(String(name)) ? 'minutes' : null);
    const isDuration = unitHint === 'hours' || /duration|minutes|minute|min|hour|hours|\(h\)/i.test(String(name));
    const display = (name === 'sleep_score')
      ? `${val}/100`
      : (isDuration && typeof val === 'number')
        ? (unitHint === 'hours' ? formatHrsToHhMm(val) : formatMinsToHhMm(val))
        : val;
    return { name, val: display, color, isDuration };
  });

  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {rows.map((r, i) => (
        <p key={i} className="tooltip-value">
          <span className="tooltip-metric" style={{ color: r.color }}>{r.name}:</span>
          <span className="tooltip-number">{r.val}</span>
        </p>
      ))}
    </div>
  );
};

// Small numeric helpers used in this file
const mean = (arr) => {
  if (!Array.isArray(arr)) return null;
  const vals = arr.map(v => Number(v)).filter(v => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null || isNaN(x) || isNaN(y)) return null;
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return null;
  return clamp(num / den, -1, 1);
}

const Sleep = () => {
  const {
    loading,
    error,
    analysis,
    analysisParams,
    timeseriesLimited,
    handleParamsChange,
    handleRefresh,
    derivedTiming,
  } = useSleepAnalysis(14);

  const timeseries = useMemo(() => (timeseriesLimited || []), [timeseriesLimited]);

  // Ensure charts show older on the left and newer on the right
  const timeseriesAsc = useMemo(() => {
    const arr = Array.isArray(timeseries) ? [...timeseries] : [];
    arr.sort((a, b) => new Date(a?.day) - new Date(b?.day));
    return arr;
  }, [timeseries]);

  // Debug: log timeseries sample and how many contain sleep_events
  if (typeof window !== 'undefined' && window && window.console) {
    const sample = (timeseries || []).slice(0,6);
    const withEvents = (timeseries || []).filter(r => Array.isArray(r?.sleep_events) || Array.isArray(r?.events) || Array.isArray(r?.garmin_sleep_events)).length;
    console.debug('timeseries sample:', sample);
    console.debug('timeseries count with events:', withEvents, 'of', (timeseries || []).length);
  }

  const fallbackMetrics = useMemo(() => {
    const avgScore = mean(timeseries.map(d => d?.sleep_score));
    // Prefer time-in-bed computed from bedtime/wake for consistency with Gantt
    const avgDuration = mean(timeseries.map(d => (
      (d?.bedtime_minutes != null && d?.wake_minutes != null)
        ? ((d.wake_minutes - d.bedtime_minutes + 1440) % 1440)
        : (d?.sleep_duration_minutes != null ? d.sleep_duration_minutes : null)
    )));
    const avgDeep = mean(timeseries.map(d => d?.deep_sleep_minutes));
    const avgRem = mean(timeseries.map(d => d?.rem_sleep_minutes));
    return { avg_sleep_score: avgScore, avg_duration: avgDuration, avg_deep_sleep_minutes: avgDeep, avg_rem_sleep_minutes: avgRem };
  }, [timeseries]);

  // Prefer backend-provided metrics but fill missing keys from computed fallbacks
  const metrics = {
    ...fallbackMetrics,
    ...(analysis?.sleep_quality_metrics || {})
  };

  // Log the source data so we can verify we're always using real data (no random generation)
  // eslint-disable-next-line no-console
  console.log('Sleep page metrics debug', { analysis: analysis?.sleep_quality_metrics, fallbackMetrics, metrics });
  const recommendations = analysis?.recommendations || [];

  // Prepare chart series
  const scoreSeries = useMemo(() => (
    timeseriesAsc.map(d => ({ x: d.day, y: Number(d.sleep_score) || null }))
  ), [timeseriesAsc]);

  // 14-day rolling trend for sleep score
  const scoreTrend14 = useMemo(() => {
    const vals = timeseriesAsc.map(d => (d?.sleep_score != null ? Number(d.sleep_score) : null));
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      // subtract element that falls out of 14-day window
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: timeseriesAsc[i]?.day, y: avg });
    }
    return out;
  }, [timeseriesAsc]);

  // 14-day average (overall in range)
  const scoreMean14 = useMemo(() => {
    const vals = timeseriesAsc.slice(-14).map(d => (d?.sleep_score != null ? Number(d.sleep_score) : null)).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return Math.round(vals.reduce((a,b) => a + b, 0) / vals.length);
  }, [timeseriesAsc]);

  const durationSeries = useMemo(() => (
    timeseriesAsc.map(d => {
      // Prefer time-in-bed (bed->wake) to match Gantt; fallback to sleep_duration_minutes
      const mins = Number(
        (d?.bedtime_minutes != null && d?.wake_minutes != null)
          ? ((d.wake_minutes - d.bedtime_minutes + 1440) % 1440)
          : (d?.sleep_duration_minutes != null ? d.sleep_duration_minutes : null)
      );
      const hours = !Number.isNaN(mins) && mins != null ? mins / 60 : null;
      return { x: d.day, y: hours };
    })
  ), [timeseriesAsc]);

  // 14-day rolling trend for sleep duration (in hours)
  const durationTrend14 = useMemo(() => {
    // Prefer time-in-bed (bed->wake) for trend consistency with Gantt
    const vals = timeseriesAsc.map(d => {
      const mins = Number(
        (d?.bedtime_minutes != null && d?.wake_minutes != null)
          ? ((d.wake_minutes - d.bedtime_minutes + 1440) % 1440)
          : (d?.sleep_duration_minutes != null ? d.sleep_duration_minutes : null)
      );
      return !Number.isNaN(mins) && mins != null ? mins / 60 : null;
    });
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: timeseriesAsc[i]?.day, y: avg });
    }
    return out;
  }, [timeseriesAsc]);

  // --- New: Series based strictly on `sleep_duration_minutes` (includes awake) ---
  const sleepDurationSeries = useMemo(() => (
    timeseriesAsc.map(d => {
      const mins = Number(d?.sleep_duration_minutes != null ? d.sleep_duration_minutes : null);
      const hours = !Number.isNaN(mins) && mins != null ? mins / 60 : null;
      return { x: d.day, y: hours };
    })
  ), [timeseriesAsc]);

  const sleepDurationTrend14 = useMemo(() => {
    const vals = sleepDurationSeries.map(d => (d?.y != null ? Number(d.y) : null));
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: sleepDurationSeries[i]?.x, y: avg });
    }
    return out;
  }, [sleepDurationSeries]);

  const composedSleepDurationData = useMemo(() => {
    const byX = new Map(sleepDurationTrend14.map(t => [String(t.x), t.y]));
    return sleepDurationSeries.map((d, i) => ({ ...d, trend: byX.get(String(d.x)) ?? null, sleep_score: timeseriesAsc[i]?.sleep_score ?? null }));
  }, [sleepDurationSeries, sleepDurationTrend14, timeseriesAsc]);

  const sleepDurationMean14 = useMemo(() => {
    const vals = sleepDurationSeries.slice(-14).map(d => (d?.y != null ? Number(d.y) : null)).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return +(vals.reduce((a,b) => a + b, 0) / vals.length).toFixed(1);
  }, [sleepDurationSeries]);

  // Merge durationSeries and durationTrend14 so chart tooltip shows distinct values
  const composedDurationData = useMemo(() => {
    const byX = new Map(durationTrend14.map(t => [String(t.x), t.y]));
    return durationSeries.map((d, i) => ({ ...d, trend: byX.get(String(d.x)) ?? null, sleep_score: timeseriesAsc[i]?.sleep_score ?? null }));
  }, [durationSeries, durationTrend14, timeseriesAsc]);

  // Helper to determine bar color: prefer actual sleep_score, otherwise fall back
  // to a duration-based pseudo-score so we use the unified score palette.
  const colorForDurationPoint = (d) => {
    if (!d) return '#e5e7eb';
    const s = d?.sleep_score;
    if (s != null && !Number.isNaN(Number(s))) return getSleepScoreColor(s);
    const h = d?.y;
    if (h == null || Number.isNaN(Number(h))) return '#e5e7eb';
    const hrs = Number(h);
    // Map hours to pseudo score buckets: <6 (Poor), 6-<7 (Fair), 7-<8 (Good), >=8 (Excellent)
    const pseudo = hrs < 6 ? 50 : hrs < 7 ? 65 : hrs < 8 ? 75 : 85;
    return getSleepScoreColor(pseudo);
  };

  // Compute upper bound for duration Y axis: max observed value (hours) + 1 hour padding
  const durationYAxisMax = useMemo(() => {
    try {
      const vals = [];
      for (const d of durationSeries) if (d?.y != null && !Number.isNaN(Number(d.y))) vals.push(Number(d.y));
      for (const d of durationTrend14) if (d?.y != null && !Number.isNaN(Number(d.y))) vals.push(Number(d.y));
      if (!vals.length) return null;
      const max = Math.max(...vals);
      return Math.ceil(max + 1); // add 1 hour padding
    } catch (e) {
      return null;
    }
  }, [durationSeries, durationTrend14]);

  // 14-day average duration (in hours)
  const durationMean14 = useMemo(() => {
    const vals = timeseriesAsc.slice(-14).map(d => {
      const mins = Number(
        (d?.bedtime_minutes != null && d?.wake_minutes != null)
          ? ((d.wake_minutes - d.bedtime_minutes + 1440) % 1440)
          : (d?.sleep_duration_minutes != null ? d.sleep_duration_minutes : null)
      );
      return !Number.isNaN(mins) && mins != null ? mins / 60 : null;
    }).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return +(vals.reduce((a,b) => a + b, 0) / vals.length).toFixed(1);
  }, [timeseriesAsc]);

  // Per-sleep average heart rate (rhr) series and 14-day rolling trend
  // helper to read a numeric field from multiple possible aliases
  const readNum = (row, keys) => {
    if (!row) return null;
    for (const k of keys) {
      if (row[k] != null && !Number.isNaN(Number(row[k]))) return Number(row[k]);
    }
    return null;
  };

  const rhrSeries = useMemo(() => (
  // Use only the per-session aggregated value `avg_sleep_hr` from garmin_sleep_sessions
  timeseriesAsc.map(d => ({ x: d.day, y: readNum(d, ['avg_sleep_hr']) }))
  ), [timeseriesAsc]);

  const rhrTrend14 = useMemo(() => {
  const vals = timeseriesAsc.map(d => readNum(d, ['avg_sleep_hr']));
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: timeseriesAsc[i]?.day, y: avg });
    }
    return out;
  }, [timeseriesAsc]);

  const rhrMean14 = useMemo(() => {
  const vals = timeseriesAsc.slice(-14).map(d => readNum(d, ['avg_sleep_hr'])).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return Math.round(vals.reduce((a,b) => a + b, 0) / vals.length);
  }, [timeseriesAsc]);

  // Per-sleep average respiratory rate and 14-day rolling trend
  const respSeries = useMemo(() => (
  // include backend `avg_sleep_rr` as a possible field name
  timeseriesAsc.map(d => ({ x: d.day, y: readNum(d, ['avg_sleep_rr', 'respiratory_rate', 'avg_respiration', 'avgRespiration', 'respiration_rate', 'respRate']) }))
  ), [timeseriesAsc]);

  const respTrend14 = useMemo(() => {
  const vals = timeseriesAsc.map(d => readNum(d, ['avg_sleep_rr', 'respiratory_rate', 'avg_respiration', 'avgRespiration', 'respiration_rate', 'respRate']));
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: timeseriesAsc[i]?.day, y: avg });
    }
    return out;
  }, [timeseriesAsc]);

  const respMean14 = useMemo(() => {
  const vals = timeseriesAsc.slice(-14).map(d => readNum(d, ['avg_sleep_rr', 'respiratory_rate', 'avg_respiration', 'avgRespiration', 'respiration_rate', 'respRate'])).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return +(vals.reduce((a,b) => a + b, 0) / vals.length).toFixed(1);
  }, [timeseriesAsc]);

  // Per-sleep average stress (stress_avg) series and 14-day rolling trend
  const stressSeries = useMemo(() => (
  // accept backend `avg_sleep_stress` in addition to other aliases
  timeseriesAsc.map(d => ({ x: d.day, y: readNum(d, ['avg_sleep_stress', 'stress_avg', 'stress', 'avg_stress']) }))
  ), [timeseriesAsc]);

  const stressTrend14 = useMemo(() => {
  const vals = timeseriesAsc.map(d => readNum(d, ['avg_sleep_stress', 'stress_avg', 'stress', 'avg_stress']));
    const out = [];
    let sum = 0, count = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
      if (i >= 14) {
        const old = vals[i - 14];
        if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
      }
      const avg = count > 0 ? sum / count : null;
      out.push({ x: timeseriesAsc[i]?.day, y: avg });
    }
    return out;
  }, [timeseriesAsc]);

  const stressMean14 = useMemo(() => {
  const vals = timeseriesAsc.slice(-14).map(d => readNum(d, ['avg_sleep_stress', 'stress_avg', 'stress', 'avg_stress'])).filter(v => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return +(vals.reduce((a,b) => a + b, 0) / vals.length).toFixed(1);
  }, [timeseriesAsc]);

  // Counts and quick debug for the three new metrics
  const rhrCount = useMemo(() => rhrSeries.filter(p => p.y != null).length, [rhrSeries]);
  const respCount = useMemo(() => respSeries.filter(p => p.y != null).length, [respSeries]);
  const stressCount = useMemo(() => stressSeries.filter(p => p.y != null).length, [stressSeries]);
  // eslint-disable-next-line no-console
  console.log('Sleep metric samples', { rhrCount, respCount, stressCount });

  // Generic helper to compute Y axis domain from series + trend arrays
  const computeDomain = (series = [], trend = [], opts = {}) => {
    try {
      const vals = [];
      for (const s of series) if (s?.y != null && !Number.isNaN(Number(s.y))) vals.push(Number(s.y));
      for (const t of trend) if (t?.y != null && !Number.isNaN(Number(t.y))) vals.push(Number(t.y));
      if (!vals.length) return null;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = Math.max(0, max - min);
      const percentPad = (opts.percent || 0.1) * range;
      const pad = Math.max(percentPad, opts.minAbsPad || 0);
      let lower = min - pad;
      let upper = max + pad;
      if (opts.minLowerBound != null) lower = Math.max(lower, opts.minLowerBound);
      // If min and max are equal (flat line), ensure a small symmetric pad
      if (range === 0) {
        const flatPad = Math.max(opts.minFlatPad || 1, pad || 1);
        lower = Math.max(min - flatPad, opts.minLowerBound != null ? opts.minLowerBound : min - flatPad);
        upper = max + flatPad;
      }
      return [Math.floor(lower), Math.ceil(upper)];
    } catch (e) {
      return null;
    }
  };

  // Domains for RHR, RR and Stress charts
  const rhrDomain = useMemo(() => computeDomain(rhrSeries, rhrTrend14, { minAbsPad: 5, percent: 0.08, minLowerBound: 0 }), [rhrSeries, rhrTrend14]);
  const respDomain = useMemo(() => computeDomain(respSeries, respTrend14, { minAbsPad: 1, percent: 0.12, minLowerBound: 0 }), [respSeries, respTrend14]);
  const stressDomain = useMemo(() => computeDomain(stressSeries, stressTrend14, { minAbsPad: 3, percent: 0.08, minLowerBound: 0 }), [stressSeries, stressTrend14]);

  // Sleep phases series (hours) per day
  const [phasesMode, setPhasesMode] = useState('time'); // 'time' | 'percent'

  const phasesSeries = useMemo(() => (
    timeseriesAsc.map(d => {
      const toHours = (m) => (m != null && !Number.isNaN(Number(m)) ? Number(m) / 60 : 0);
      const deepH = toHours(d?.deep_sleep_minutes);
      const lightH = toHours(d?.light_sleep_minutes);
      const remH = toHours(d?.rem_sleep_minutes);
      const awakeH = toHours(d?.awake_minutes);
      const total = deepH + lightH + remH + awakeH;
      if (phasesMode === 'percent' && total > 0) {
        return {
          x: d.day,
          deep: deepH / total,
          light: lightH / total,
          rem: remH / total,
          awake: awakeH / total,
          deepH, lightH, remH, awakeH,
        };
      }
      return { x: d.day, deep: deepH, light: lightH, rem: remH, awake: awakeH, deepH, lightH, remH, awakeH };
    })
  ), [timeseriesAsc, phasesMode]);

  // --- New: compute last sleep phase before wake for each session ---
  const lastPreWakeSeries = useMemo(() => {
    const mapStageValue = (s) => {
      const st = String(s || '').toLowerCase();
      if (st.includes('deep')) return { v: 1, label: 'Deep' };
      if (st.includes('rem')) return { v: 3, label: 'REM' };
      if (st.includes('light')) return { v: 2, label: 'Light' };
      if (st.includes('awake') || st.includes('wake')) return { v: 4, label: 'Awake' };
      return { v: 0, label: '' };
    };

    return timeseriesAsc.map(row => {
        // Prefer garmin_sleep_events (migrated Postgres table) when present
        const evs = Array.isArray(row?.garmin_sleep_events)
          ? row.garmin_sleep_events
          : (Array.isArray(row?.sleep_events) ? row.sleep_events : (Array.isArray(row?.events) ? row.events : null));
      if (!evs || !evs.length) return { x: row.day, phaseValue: null, phaseLabel: null };
      const toMs = (e) => e && e.timestamp ? new Date(e.timestamp).getTime() : (e && e.ts ? new Date(e.ts).getTime() : (typeof e.t === 'number' ? e.t : null));
      const mapped = evs
        .filter(e => (e && (e.event || e.stage || e.type)))
        .map(e => ({ t: toMs(e), name: String(e.event || e.stage || e.type || '').toLowerCase() }))
        .filter(e => typeof e.t === 'number')
        .sort((a,b) => a.t - b.t);
      if (!mapped.length) return { x: row.day, phaseValue: null, phaseLabel: null };
      let last = mapped[mapped.length - 1];
      // if last is an awake/wake event, pick the previous stage when possible
      if ((last.name || '').includes('awake') || (last.name || '').includes('wake')) {
        if (mapped.length >= 2) last = mapped[mapped.length - 2];
      }
      const mv = mapStageValue(last.name);
      return { x: row.day, phaseValue: mv.v, phaseLabel: mv.label };
    });
  }, [timeseriesAsc]);

  // Debug: surface counts/examples to browser console to help diagnose missing data
  try {
    // defer logging until in browser environment
    if (typeof window !== 'undefined' && window && window.console) {
      console.debug('lastPreWakeSeries sample:', (lastPreWakeSeries || []).slice(0,6));
      console.debug('lastPreWakeSeries count:', (lastPreWakeSeries || []).length);
    }
  } catch (e) {
    // ignore in non-browser env
  }

  // 14-day rolling trends for sleep phases (hours)
  const [deepTrend14, lightTrend14, remTrend14, awakeTrend14] = useMemo(() => {
    const compute = (vals, xs) => {
      const out = [];
      let sum = 0, count = 0;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v != null && !Number.isNaN(v)) { sum += v; count += 1; }
        if (i >= 14) {
          const old = vals[i - 14];
          if (old != null && !Number.isNaN(old)) { sum -= old; count -= 1; }
        }
        const avg = count > 0 ? sum / count : null;
        out.push({ x: xs[i], y: avg });
      }
      return out;
    };
    const xs = phasesSeries.map(r => r.x);
    const deepVals = phasesSeries.map(r => r.deep);
    const lightVals = phasesSeries.map(r => r.light);
    const remVals = phasesSeries.map(r => r.rem);
    const awakeVals = phasesSeries.map(r => r.awake);
    return [
      compute(deepVals, xs),
      compute(lightVals, xs),
      compute(remVals, xs),
      compute(awakeVals, xs),
    ];
  }, [phasesSeries]);

  // 14-day mean per phase (hours)
  const [deepMean14, lightMean14, remMean14, awakeMean14] = useMemo(() => {
    const last = phasesSeries.slice(-14);
    const avg = (arr) => {
      const vals = arr.filter(v => v != null && !Number.isNaN(v));
      if (!vals.length) return null;
      return vals.reduce((a,b) => a + b, 0) / vals.length;
    };
    return [
      avg(last.map(r => r.deep)),
      avg(last.map(r => r.light)),
      avg(last.map(r => r.rem)),
      avg(last.map(r => r.awake)),
    ];
  }, [phasesSeries]);

  // Format X axis as weekday names instead of full dates (for Sleep Score Trend)
  const weekdayTick = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return names[d.getDay()];
  };

  const phasesTickY = (v) => phasesMode === 'percent' ? `${Math.round(v*100)}%` : formatHoursHhMm(v);

  const formatPhaseTooltip = (label, payload) => {
    // payload entries correspond to deep/light/rem/awake in current mode
    // we read original hours from payload[0].payload.deepH etc.
  const p = (payload && payload[0] && payload[0].payload) || {};
    const entries = [
      { key: 'deep', label: 'Deep', color: '#8b5cf6' },
      { key: 'light', label: 'Light', color: '#22c55e' },
      { key: 'rem', label: 'REM', color: '#06b6d4' },
      { key: 'awake', label: 'Awake', color: '#ef4444' },
    ];
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {entries.map(({key, label, color}) => {
          const rawH = p[`${key}H`];
          const val = p[key];
          let valText;
          if (phasesMode === 'percent') {
            valText = `${Math.round((val || 0)*100)}%`;
          } else {
            // phasesMode === 'time', values are fractional hours (e.g. 4.8333)
            valText = formatHoursHhMm(val);
          }
          const hoursText = rawH != null ? formatHoursHhMm(rawH) : null;
          return (
            <p key={key} className="tooltip-value">
              <span className="tooltip-metric" style={{ color }}>{label}:</span>
              <span className="tooltip-number">{valText}{hoursText ? ` (${hoursText})` : ''}</span>
            </p>
          );
        })}
      </div>
    );
  };

// Wrapper component to use the phase-specific tooltip function with Recharts
const PhaseTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return formatPhaseTooltip(label, payload);
};

  // Format numeric hours into "Xh Ym"
  const formatHoursHhMm = (hours) => {
    if (hours == null || isNaN(hours)) return '';
    const h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) { m = 0; return `${h + 1}h`; }
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Format minutes into "Xh Ym"
  const formatMinutesHhMm = (mins) => {
    if (mins == null || isNaN(mins)) return '';
    const total = Math.round(mins);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Select metrics for correlation dynamically (only those with enough numeric data)
  // Use a fixed, ordered set of fields for the correlation heatmap as requested
  const correlationFields = useMemo(() => ([
  'sleep_score',
  'last_pre_wake_phase',
  // backend-provided per-sleep vitals
  'avg_sleep_hr',
  'avg_sleep_rr',
  'avg_sleep_stress',
    'sleep_efficiency',
    'sleep_duration_minutes', // time in bed
    'awake_minutes',
    'deep_sleep_minutes',
    'rem_sleep_minutes',
    'deep_sleep_percentage',
    'rem_sleep_percentage',
    'next_energy',
    'next_rhr',
    'next_mood',
    'prev_steps',
    'prev_vigorous_activity',
    'prev_stress',
    'bedtime_minutes',
    'wake_minutes',
  ]), []);
  // Build a cleaned timeseries with derived numeric fields so correlations can
  // be computed even when some raw fields are missing (e.g. duration from bed/wake)
  // lastPreWakeSeries is derived from timeseriesAsc and intentionally not listed in deps
  // as including it can cause noisy/incorrect lint messages here; the mapping below
  // performs safe lookups and will update when timeseriesAsc changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cleanedTimeseries = useMemo(() => {
    const toNum = (v) => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const computeDuration = (row) => {
  // Prefer derived time-in-bed from bedtime/wake so correlations align with Gantt
  const b = toNum(row?.bedtime_minutes);
  const w = toNum(row?.wake_minutes);
  if (b != null && w != null) return ( (w - b + 1440) % 1440 );
  const dur = toNum(row?.sleep_duration_minutes);
  if (dur != null) return dur;
  return null;
    };

    return timeseriesAsc.map(r => {
      const duration = computeDuration(r);
      const deep = toNum(r?.deep_sleep_minutes);
      const rem = toNum(r?.rem_sleep_minutes);
      const awake = toNum(r?.awake_minutes);

      const deepPct = (r?.deep_sleep_percentage != null) ? toNum(r.deep_sleep_percentage) : (duration ? (deep != null ? (deep / duration * 100) : null) : null);
      const remPct = (r?.rem_sleep_percentage != null) ? toNum(r.rem_sleep_percentage) : (duration ? (rem != null ? (rem / duration * 100) : null) : null);

      // Support multiple possible field names for efficiency coming from backend
      // Normalize to `sleep_efficiency` as percent (0-100)
      let effRaw = null;
      if (r?.sleep_efficiency != null) effRaw = r.sleep_efficiency;
      else if (r?.efficiency_pct != null) effRaw = r.efficiency_pct;
      else if (r?.efficiency != null) effRaw = r.efficiency;
      else if (r?.eff != null) effRaw = r.eff;
      else if (r?.efficiencyPct != null) effRaw = r.efficiencyPct;
      let eff = toNum(effRaw);
      if (eff != null) {
        // if returned value is between 0 and 1, assume fraction and convert to percent
        if (eff >= 0 && eff <= 1) eff = eff * 100;
        eff = clamp(eff, 0, 100);
      }

      return {
        ...r,
        last_pre_wake_phase: (() => {
          try {
            const found = (lastPreWakeSeries || []).find(p => String(p.x) === String(r.day));
            return found && typeof found.phaseValue === 'number' ? found.phaseValue : null;
          } catch (e) { return null; }
        })(),
        last_pre_wake_phase_label: (() => {
          try { const found = (lastPreWakeSeries || []).find(p => String(p.x) === String(r.day)); return found ? found.phaseLabel : null; } catch(e){return null}
        })(),
        sleep_score: toNum(r?.sleep_score),
        sleep_efficiency: eff,
        sleep_duration_minutes: duration,
        awake_minutes: toNum(awake),
        deep_sleep_minutes: deep,
        rem_sleep_minutes: rem,
        deep_sleep_percentage: deepPct,
        rem_sleep_percentage: remPct,
        next_energy: toNum(r?.next_energy),
        next_rhr: toNum(r?.next_rhr),
        next_mood: toNum(r?.next_mood),
        prev_steps: toNum(r?.prev_steps),
        prev_vigorous_activity: toNum(r?.prev_vigorous_activity),
        prev_stress: toNum(r?.prev_stress),
        bedtime_minutes: toNum(r?.bedtime_minutes),
        wake_minutes: toNum(r?.wake_minutes),
      };
    });
  }, [timeseriesAsc, lastPreWakeSeries]);

  // Build pairwise correlations for CorrelationMatrix using cleanedTimeseries
  const correlationItems = useMemo(() => {
    const items = [];
    const normalizeFieldBase = (f) => {
      if (!f) return '';
      let s = String(f).toLowerCase();
      // strip common prefixes
      s = s.replace(/^(avg_|next_|prev_)/, '');
      // strip common unit suffixes
      s = s.replace(/_(minutes|minute|percentage|percent|pct|duration|hours)$/, '');
      return s;
    };
    const isTrivialPair = (a, b) => {
      if (!a || !b) return false;
      const na = normalizeFieldBase(a);
      const nb = normalizeFieldBase(b);
      if (na !== nb) return false;
      // if both share same base but have different unit-like suffixes, treat as trivial
      const suffRegex = /_(minutes|minute|percentage|percent|pct|duration|hours)$/;
      const sa = String(a).toLowerCase().match(suffRegex);
      const sb = String(b).toLowerCase().match(suffRegex);
      if (sa && sb && sa[1] !== sb[1]) return true;
      return false;
    };
    for (let i = 0; i < correlationFields.length; i++) {
      for (let j = i + 1; j < correlationFields.length; j++) {
        const f1 = correlationFields[i];
        const f2 = correlationFields[j];
        // skip trivial derived pairs (e.g. deep_sleep_minutes vs deep_sleep_percentage)
        if (isTrivialPair(f1, f2)) continue;
        const xs = [];
        const ys = [];
        for (const row of cleanedTimeseries) {
          const x = row?.[f1];
          const y = row?.[f2];
          if (x != null && y != null) {
            xs.push(Number(x));
            ys.push(Number(y));
          }
        }
        const r = pearson(xs, ys);
        // include item even if r is null so the UI can show sample size and absence
        items.push({ field1: f1, field2: f2, correlation: r, n: xs.length });
      }
    }
    // sort by available sample size and absolute correlation
    return items.sort((a, b) => {
      const na = a.n || 0; const nb = b.n || 0;
      if (na !== nb) return nb - na;
      return Math.abs(b.correlation || 0) - Math.abs(a.correlation || 0);
    });
  }, [cleanedTimeseries, correlationFields]);

  // IMPORTANT: compute hasAnyData before any early returns so hooks count stays stable
  const hasAnyData = useMemo(() => {
    if (!Array.isArray(timeseries) || timeseries.length === 0) return false;
    const anyScore = timeseries.some(d => d?.sleep_score != null && !Number.isNaN(Number(d.sleep_score)));
    const anyDuration = timeseries.some(d => d?.sleep_duration_minutes != null && !Number.isNaN(Number(d.sleep_duration_minutes)));
    return anyScore || anyDuration;
  }, [timeseries]);

  if (loading && !analysis) {
    return <LoadingSpinner message="Analyzing sleep patterns..." />;
  }

  if (error && !analysis) {
    return <ErrorMessage message={error} onRetry={handleRefresh} />;
  }

  if (!hasAnyData) {
    return (
      <div className="sleep-page fade-in">
        <div className="page-header">
          <div className="header-content">
            <h1 className="page-title">
              <span className="title-icon">😴</span>
              Sleep Analysis
            </h1>
            <p className="page-subtitle">We couldn't find sleep data for the selected period.</p>
          </div>
          <div className="header-controls">
            <select
              value={analysisParams.days}
              onChange={(e) => handleParamsChange({ days: parseInt(e.target.value, 10) })}
              className="period-select"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 2 weeks</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 2 months</option>
            </select>
            <button onClick={handleRefresh} disabled={loading} className="btn btn-primary">
              {loading ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No data available</h3>
            <p className="card-subtitle">Try expanding the period or ensure the backend is running.</p>
          </div>
          <div className="card-content" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[7,14,30,60].map(d => (
              <button key={d} className="btn" onClick={() => { handleParamsChange({ days: d }); handleRefresh(); }}>
                Use {d} days
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sleep-page fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">😴</span>
            Sleep Analysis
          </h1>
          <p className="page-subtitle">Comprehensive analysis of your sleep quality, timing, and correlations</p>
        </div>
        <div className="header-controls">
          <select
            value={analysisParams.days}
            onChange={(e) => handleParamsChange({ days: parseInt(e.target.value, 10) })}
            className="period-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 2 months</option>
          </select>
          <button onClick={handleRefresh} disabled={loading} className="btn btn-primary">
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="sleep-overview">
        <h3>Sleep Overview</h3>
        <div className="overview-metrics">
          {/* Avg Sleep Score: ensure numeric */}
          <MetricCard
            title="Avg Sleep Score"
            value={metrics?.avg_sleep_score != null && !Number.isNaN(Number(metrics.avg_sleep_score)) ? Math.round(Number(metrics.avg_sleep_score)) : 'N/A'}
            unit={metrics?.avg_sleep_score != null ? '' : ''}
            icon="⭐"
            color="blue"
            subtitle="0-100"
          />

          {/* Avg Duration: pass hours as number when possible, otherwise formatted string */}
          {metrics?.avg_duration != null && !Number.isNaN(Number(metrics.avg_duration)) ? (
            <MetricCard
              title="Avg Duration"
              value={+(Number(metrics.avg_duration) / 60).toFixed(1)}
              unit="h"
              icon="⏱️"
              color="green"
              subtitle="Per night"
            />
          ) : (
            <MetricCard title="Avg Duration" value="N/A" icon="⏱️" color="green" subtitle="Per night" />
          )}

          {/* Deep / REM averages expect minutes; display as formatted string but MetricCard can accept string value */}
          <MetricCard
            title="Deep Sleep (avg)"
            value={metrics?.avg_deep_sleep_minutes != null && !Number.isNaN(Number(metrics.avg_deep_sleep_minutes)) ? formatMinutesHhMm(metrics.avg_deep_sleep_minutes) : 'N/A'}
            icon="🌙"
            color="purple"
          />
          <MetricCard
            title="REM Sleep (avg)"
            value={metrics?.avg_rem_sleep_minutes != null && !Number.isNaN(Number(metrics.avg_rem_sleep_minutes)) ? formatMinutesHhMm(metrics.avg_rem_sleep_minutes) : 'N/A'}
            icon="🧠"
            color="indigo"
          />
        </div>
      </div>

      {/* Timing and Gantt */}
      <SleepTimingAnalysis 
        timing={analysis?.sleep_timing || analysis?.sleep_timing_analysis || {}}
        derivedTiming={derivedTiming}
        timeseries={timeseries}
        analysisParams={analysisParams}
      />

      {/* Distributions */}
      <div className="sleep-distributions">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Bedtime Distribution</h3>
          </div>
          <div className="card-content">
            <SleepHistogram timeseries={timeseries} metric="bedtime_minutes" color="#0ea5e9" daysLimit={analysisParams.days} avgMinutes14={derivedTiming?.computedMedianBedMin ?? derivedTiming?.computedAvgBedMin} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Wake Time Distribution</h3>
          </div>
          <div className="card-content">
            <SleepHistogram timeseries={timeseries} metric="wake_minutes" color="#22c55e" daysLimit={analysisParams.days} avgMinutes14={derivedTiming?.computedMedianWakeMin ?? derivedTiming?.computedAvgWakeMin} />
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Last Phase Before Wake</h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">Which sleep phase you were in just before waking</p>
          </div>
          <div className="card-content">
            {/* distribution computed from lastPreWakeSeries */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-around' }}>
              {(()=>{
                const counts = { Deep:0, Light:0, REM:0, Awake:0, Unknown:0 };
                for (const p of lastPreWakeSeries) {
                  if (!p || p.phaseLabel == null) { counts.Unknown += 1; continue; }
                  if (counts[p.phaseLabel] == null) counts[p.phaseLabel] = 0;
                  counts[p.phaseLabel] += 1;
                }
                const total = Math.max(1, lastPreWakeSeries.length);
                const entries = [ ['Deep','#8b5cf6'], ['Light','#22c55e'], ['REM','#06b6d4'], ['Awake','#ef4444'] ];
                return (
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {entries.map(([label, color]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 12, height: 12, background: color, borderRadius: 3 }} />
                          <div>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      {entries.map(([label, color]) => {
                        const cnt = counts[label] || 0;
                        const pct = Math.round((cnt / total) * 100);
                        return (
                          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ height: `${Math.max(8, pct)}px`, background: color, margin: '0 auto', width: '60%', borderRadius: 4 }} />
                            <div style={{ marginTop: 8 }}>{cnt} ({pct}%)</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="sleep-trends">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sleep Phases Trend</h3>
              <div className="chart-controls" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className={`btn ${phasesMode === 'time' ? 'btn-primary' : ''}`} onClick={() => setPhasesMode('time')}>
                  Hours
                </button>
                <button className={`btn ${phasesMode === 'percent' ? 'btn-primary' : ''}`} onClick={() => setPhasesMode('percent')}>
                  %
                </button>
              </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={phasesSeries} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                <YAxis fontSize={12} tickFormatter={phasesTickY} />
                <Tooltip content={<PhaseTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="deep" name={phasesMode === 'percent' ? 'Deep (%)' : 'Deep (h)'} stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.35} />
                <Area type="monotone" dataKey="light" name={phasesMode === 'percent' ? 'Light (%)' : 'Light (h)'} stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.35} />
                <Area type="monotone" dataKey="rem" name={phasesMode === 'percent' ? 'REM (%)' : 'REM (h)'} stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.35} />
                <Area type="monotone" dataKey="awake" name={phasesMode === 'percent' ? 'Awake (%)' : 'Awake (h)'} stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
                              <Line type="monotone" data={deepTrend14} dataKey="y" name="Deep 14d (h)" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" data={lightTrend14} dataKey="y" name="Light 14d (h)" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" data={remTrend14} dataKey="y" name="REM 14d (h)" stroke="#0891b2" strokeWidth={2} dot={false} />
                <Line type="monotone" data={awakeTrend14} dataKey="y" name="Awake 14d (h)" stroke="#dc2626" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="chart-subtitle" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: -15 }}>
              {deepMean14 != null && (
                <span style={{ color: '#8b5cf6' }}>Deep avg: <strong>{phasesMode === 'percent' ? `${Math.round((deepMean14||0)*100)}%` : formatHoursHhMm(deepMean14)}</strong></span>
              )}
              {lightMean14 != null && (
                <span style={{ color: '#22c55e' }}>Light avg: <strong>{phasesMode === 'percent' ? `${Math.round((lightMean14||0)*100)}%` : formatHoursHhMm(lightMean14)}</strong></span>
              )}
              {remMean14 != null && (
                <span style={{ color: '#06b6d4' }}>REM avg: <strong>{phasesMode === 'percent' ? `${Math.round((remMean14||0)*100)}%` : formatHoursHhMm(remMean14)}</strong></span>
              )}
              {awakeMean14 != null && (
                <span style={{ color: '#ef4444' }}>Awake avg: <strong>{phasesMode === 'percent' ? `${Math.round((awakeMean14||0)*100)}%` : formatHoursHhMm(awakeMean14)}</strong></span>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sleep Score Trend</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={scoreSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                <YAxis domain={[0,100]} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="y" name="Sleep score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" data={scoreTrend14} dataKey="y" name="14d trend" stroke="#ef4444" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            {scoreMean14 != null && (
              <div className="chart-subtitle">14-day average: <strong>{scoreMean14}</strong></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sleep Duration Trend</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={composedDurationData} syncId="durationSync">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                <YAxis fontSize={12} tickFormatter={formatHoursHhMm} domain={durationYAxisMax != null ? [0, durationYAxisMax] : undefined} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="y" name="Sleep duration (h)" fill="#10b981" radius={[4,4,0,0]}>
                  {composedDurationData.map((d, i) => (
                    <Cell key={i} fill={colorForDurationPoint(d)} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="trend" name="14d trend (h)" stroke="#ef4444" strokeDasharray="5 4" strokeWidth={2} dot={false} yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>
            {durationMean14 != null && (
              <div className="chart-subtitle">14-day average: <strong>{formatHoursHhMm(durationMean14)}</strong></div>
            )}
          </div>
        </div>
        
        {/* Additional chart: sleep_duration (incl. awake) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sleep Duration - Awake Trend</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={composedSleepDurationData} syncId="durationSync">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                <YAxis fontSize={12} tickFormatter={formatHoursHhMm} domain={durationYAxisMax != null ? [0, durationYAxisMax] : undefined} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="y" name="Sleep duration (h)" fill="#3b82f6" radius={[4,4,0,0]}>
                  {composedSleepDurationData.map((d, i) => (
                    <Cell key={i} fill={colorForDurationPoint(d)} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="trend" name="14d trend (h)" stroke="#ef4444" strokeDasharray="5 4" strokeWidth={2} dot={false} yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>
            {sleepDurationMean14 != null && (
              <div className="chart-subtitle">14-day average: <strong>{formatHoursHhMm(sleepDurationMean14)}</strong></div>
            )}
          </div>
        </div>
        
          {/* New: Per-sleep Average Heart Rate, Respiratory Rate, Stress */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Avg Heart Rate per Sleep</h3>
            </div>
            <div className="chart-container">
              {rhrCount > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={rhrSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                      <YAxis fontSize={12} domain={rhrDomain != null ? rhrDomain : undefined} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="y" name="RHR (bpm)" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" data={rhrTrend14} dataKey="y" name="14d trend" stroke="#3b82f6" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  {rhrMean14 != null && (<div className="chart-subtitle">14-day average: <strong>{rhrMean14} bpm</strong></div>)}
                </>
              ) : (
                <div style={{ padding: 24, color: 'var(--muted)' }}>
                  <div>No heart rate samples found for the selected period.</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleParamsChange({ days: Math.min(90, (analysisParams.days || 14) * 2) })}>Expand range</button>
                    <button className="btn" onClick={() => handleRefresh()}>Refresh</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Avg Respiratory Rate per Sleep</h3>
            </div>
            <div className="chart-container">
              {respCount > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={respSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                        <YAxis fontSize={12} domain={respDomain != null ? respDomain : undefined} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="y" name="Respiratory rate (brpm)" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      <Line type="monotone" data={respTrend14} dataKey="y" name="14d trend" stroke="#3b82f6" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  {respMean14 != null && (<div className="chart-subtitle">14-day average: <strong>{respMean14} brpm</strong></div>)}
                </>
              ) : (
                <div style={{ padding: 24, color: 'var(--muted)' }}>
                  <div>No respiratory rate samples found for the selected period.</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleParamsChange({ days: Math.min(90, (analysisParams.days || 14) * 2) })}>Expand range</button>
                    <button className="btn" onClick={() => handleRefresh()}>Refresh</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Avg Stress per Sleep</h3>
            </div>
            <div className="chart-container">
              {stressCount > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stressSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="x" fontSize={12} tickFormatter={weekdayTick} />
                        <YAxis fontSize={12} domain={stressDomain != null ? stressDomain : undefined} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="y" name="Stress (avg)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <Line type="monotone" data={stressTrend14} dataKey="y" name="14d trend" stroke="#3b82f6" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  {stressMean14 != null && (<div className="chart-subtitle">14-day average: <strong>{stressMean14}</strong></div>)}
                </>
              ) : (
                <div style={{ padding: 24, color: 'var(--muted)' }}>
                  <div>No stress samples found for the selected period.</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleParamsChange({ days: Math.min(90, (analysisParams.days || 14) * 2) })}>Expand range</button>
                    <button className="btn" onClick={() => handleRefresh()}>Refresh</button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Correlations */}
      <div className="sleep-correlations">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Correlation Heatmap</h3>
            <p className="card-subtitle">Pearson correlation across selected metrics</p>
          </div>
          <div className="card-content">
            <CorrelationHeatmap data={cleanedTimeseries} fields={correlationFields} title="Sleep-related Correlations" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Correlations</h3>
          </div>
          <div className="card-content">
            <CorrelationMatrix data={correlationItems} maxItems={12} />
          </div>
        </div>
      </div>

      {/* Recommendations & Guide */}
      {recommendations && recommendations.length > 0 && (
        <div className="sleep-recommendations">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recommendations</h3>
            </div>
            <div className="card-content">
              <ul className="recommendations-list">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="recommendation-item">💡 {typeof rec === 'string' ? rec : rec?.text || String(rec)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <SleepQualityZones />

      <style jsx>{`
        :global(.custom-tooltip) {
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          padding: 10px 12px;
          border-radius: 10px;
          min-width: 140px;
        }
        :global(.tooltip-label) { margin: 0 0 8px 0; font-weight: 600; color: #0f172a; }
        :global(.dark .tooltip-label) { color: #f1f5f9; }
        :global(.tooltip-value) { margin: 0 0 4px 0; display: flex; justify-content: space-between; gap: 12px; }
        :global(.tooltip-metric) { color: #64748b; }
        :global(.dark .tooltip-metric) { color: #94a3b8; }
        :global(.tooltip-number) { font-weight: 600; color: #0ea5e9; }

        .sleep-page { max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .dark .page-header { border-bottom-color: #334155; }
        .header-content { flex: 1; }
        .page-title { display: flex; align-items: center; gap: 12px; font-size: 2rem; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; }
        .dark .page-title { color: #f1f5f9; }
        .title-icon { font-size: 2.5rem; }
        .page-subtitle { color: #64748b; margin: 0; font-size: 1rem; }
        .dark .page-subtitle { color: #94a3b8; }
        .header-controls { display: flex; gap: 12px; align-items: center; }
        .period-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; color: #1e293b; font-size: 0.875rem; }
        .dark .period-select { background: #334155; border-color: #475569; color: #f1f5f9; }

        .sleep-overview { margin-bottom: 32px; }
        .sleep-overview h3 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; }
        .dark .sleep-overview h3 { color: #f1f5f9; }
        .overview-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }

        .sleep-distributions, .sleep-trends, .sleep-correlations, .sleep-recommendations { margin-bottom: 32px; }
        .chart-container { padding: 24px; }

        .recommendations-list { display: flex; flex-direction: column; gap: 8px; }
        .recommendation-item { padding: 12px; background: #f0f9ff; border-left: 4px solid #38bdf8; border-radius: 0 8px 8px 0; }
        .dark .recommendation-item { background: #1e3a8a; border-left-color: #60a5fa; color: #f1f5f9; }

        .loading-spinner { width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px; }
        .w-4 { width: 1rem; }
        .h-4 { height: 1rem; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .page-header { flex-direction: column; gap: 16px; }
          .overview-metrics { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        }
      `}</style>
    </div>
  );
};

export default Sleep;
