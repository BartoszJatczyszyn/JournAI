import React, { useMemo, useState } from 'react';
// Link import removed (not used in this view)
import useActivityAggregates from '../hooks/useActivityAggregates';
import useActivityPredictions from '../hooks/useActivityPredictions';
import useGoalSimulation from '../hooks/useGoalSimulation';
import TrendComparison from '../components/TrendComparison';
// SegmentedControl not used here
// import SegmentedControl from '../components/SegmentedControl';
// Sparkline no longer used for weekly distance/pace (replaced by enhanced charts)
import WeeklyDistanceChart from '../components/WeeklyDistanceChart';
import WeeklyPaceChart from '../components/WeeklyPaceChart';
import MetricCard from '../components/MetricCard';
// CorrelationMatrix intentionally not imported here to avoid duplicate display; full styled list used instead
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import { formatPaceMinPerKm, paceMinPerKm, durationToMinutes, parsePaceToMinutes } from '../utils/timeUtils';
import { lowerIsBetterNote } from '../utils/metricUtils';
import { activitiesAPI } from '../services';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import RunningVO2MaxTrend from '../components/RunningVO2MaxTrend';
import RunningDuoScatter from '../components/RunningDuoScatter';
import RunningEconomyPanel from '../components/RunningEconomyPanel';
// TooltipStyles injected globally in App
import DistanceBucketComparison from '../components/DistanceBucketComparison';
import { Button } from '../components/ui';
import PaceHrChart from '../components/PaceHrChart';

// Focused running analytics view: filters activities to sport 'running' / 'Running'
const Running = () => {
  const [allActivities, setAllActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(200);
  const [periodDays, setPeriodDays] = useState(() => {
    const raw = localStorage.getItem('runningPeriodDays');
    const parsed = Number(raw);
    return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30;
  });
  const [predWindow, setPredWindow] = useState(() => {
    try { const raw = localStorage.getItem('runningPredWindow'); const v = Number(raw); return Number.isFinite(v) && v > 0 ? v : 8; } catch (e) { return 8; }
  });
  const [predAlpha, setPredAlpha] = useState(() => {
    try { const raw = localStorage.getItem('runningPredAlpha'); const v = Number(raw); return Number.isFinite(v) ? v : 0.5; } catch (e) { return 0.5; }
  });
  const [predBlend, setPredBlend] = useState(() => {
    try { const raw = localStorage.getItem('runningPredBlend'); const v = Number(raw); return Number.isFinite(v) ? v : 0.6; } catch (e) { return 0.6; }
  });
  const [simDistanceGoal, setSimDistanceGoal] = useState('');
  const [simPaceGoal, setSimPaceGoal] = useState('');
  // removed showAggregated per UI simplification

  // server-provided running analysis
  const [runningAnalysis, setRunningAnalysis] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('rolling'); // 'rolling' | 'explicit'
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [primaryMetric, setPrimaryMetric] = useState(() => {
    try { const raw = localStorage.getItem('runningPrimaryMetric'); return raw === 'avg_steps_per_min' ? 'avg_steps_per_min' : 'avg_pace'; } catch (e) { return 'avg_pace'; }
  });
  React.useEffect(() => { try { localStorage.setItem('runningPrimaryMetric', primaryMetric); } catch (e) { /* ignore */ } }, [primaryMetric]);

  // UI toggles for Pace & HR chart
  const [showHrZones, setShowHrZones] = useState(() => {
    try { return localStorage.getItem('runningShowHrZones') !== '0'; } catch (e) { return true; }
  });
  const [showTrendLines, setShowTrendLines] = useState(() => {
    try { return localStorage.getItem('runningShowTrendLines') !== '0'; } catch (e) { return true; }
  });
  const [showAvgLines, setShowAvgLines] = useState(() => {
    try { return localStorage.getItem('runningShowAvgLines') !== '0'; } catch (e) { return true; }
  });
  const [distanceDotScale, setDistanceDotScale] = useState(() => {
    try { return localStorage.getItem('runningDistanceDotScale') !== '0'; } catch (e) { return true; }
  });
  const [showAvgHr, setShowAvgHr] = useState(() => { try { return localStorage.getItem('runningShowAvgHr') !== '0'; } catch (e) { return true; } });
  const [showMaxHr, setShowMaxHr] = useState(() => { try { return localStorage.getItem('runningShowMaxHr') !== '0'; } catch (e) { return true; } });
  React.useEffect(() => { try { localStorage.setItem('runningShowHrZones', showHrZones ? '1':'0'); } catch (e) { /* ignore */ } }, [showHrZones]);
  React.useEffect(() => { try { localStorage.setItem('runningShowTrendLines', showTrendLines ? '1':'0'); } catch (e) { /* ignore */ } }, [showTrendLines]);
  React.useEffect(() => { try { localStorage.setItem('runningShowAvgLines', showAvgLines ? '1':'0'); } catch (e) { /* ignore */ } }, [showAvgLines]);
  React.useEffect(() => { try { localStorage.setItem('runningDistanceDotScale', distanceDotScale ? '1':'0'); } catch (e) { /* ignore */ } }, [distanceDotScale]);
  React.useEffect(() => { try { localStorage.setItem('runningShowAvgHr', showAvgHr ? '1':'0'); } catch (e) { /* ignore */ } }, [showAvgHr]);
  React.useEffect(() => { try { localStorage.setItem('runningShowMaxHr', showMaxHr ? '1':'0'); } catch (e) { /* ignore */ } }, [showMaxHr]);

  React.useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        // Load raw activities (for client-side exploration)
        const res = await activitiesAPI.getLatestActivities(limit);
        setAllActivities(res.activities || []);

        // Also request server-side running analytics (enriched) if available
        try {
          let url = `/api/analytics/running?days=${periodDays}`;
          if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
            url += `&start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
          }
          const runRes = await api.get(url);
          if (runRes && runRes.running_analysis && Array.isArray(runRes.running_analysis.runs)) {
            setRunningAnalysis(runRes.running_analysis);
          }
        } catch (e) {
          // non-fatal: server may not have endpoint or DB access
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load activities');
      } finally {
        setBusy(false);
      }
    };
    load();
  }, [limit, periodDays, dateRangeMode, rangeStart, rangeEnd]);

  // Helper: increase period to 90 days when no runs are present
  const handleIncreasePeriod = () => {
    setPeriodDays(90);
  };


  

  // Persist period selection
  React.useEffect(() => {
    try { localStorage.setItem('runningPeriodDays', String(periodDays)); } catch (e) { /* ignore */ }
  }, [periodDays]);

  React.useEffect(() => {
    try { localStorage.setItem('runningPredWindow', String(predWindow)); } catch (e) { /* ignore */ }
  }, [predWindow]);
  React.useEffect(() => {
    try { localStorage.setItem('runningPredAlpha', String(predAlpha)); } catch (e) { /* ignore */ }
  }, [predAlpha]);
  React.useEffect(() => {
    try { localStorage.setItem('runningPredBlend', String(predBlend)); } catch (e) { /* ignore */ }
  }, [predBlend]);

  // showAggregated persistence removed

  // Adjust fetch limit heuristically when period changes and trigger reload via limit change
  React.useEffect(() => {
    const map = { 7: 100, 14: 200, 30: 400, 60: 800, 90: 1000, 180: 1500, 365: 2500 };
    const newLimit = map[periodDays] || 400;
    if (newLimit !== limit) setLimit(newLimit);
    // load will be triggered by limit change effect
  }, [periodDays, limit]);
  // compute lastRunning (timestamp of the most recent running activity) early so other hooks can use it
  const lastRunning = React.useMemo(() => {
    const runningTimestamps = allActivities.map(a => {
      try { if ((a.sport || '').toLowerCase() !== 'running') return null; const t = new Date(a.start_time).getTime(); return Number.isNaN(t) ? null : t; } catch (e) { return null; }
    }).filter(Boolean);
    return runningTimestamps.length ? Math.max(...runningTimestamps) : Date.now();
  }, [allActivities]);

  const runningActivities = useMemo(() => {
    const cutoff = lastRunning - (periodDays * 24 * 60 * 60 * 1000);
    return allActivities.filter(a => {
      if (!a.start_time) return false;
      if ((a.sport || '').toLowerCase() !== 'running') return false;
      const t = new Date(a.start_time).getTime();
      return !Number.isNaN(t) && t >= cutoff && t <= lastRunning;
    });
  }, [allActivities, periodDays, lastRunning]);
  const aggregates = useActivityAggregates(runningActivities);
  // Normalize weekly groups (memoized to avoid changing reference each render)
  const weeklyGroups = React.useMemo(() => (aggregates.weeklyGroups || aggregates.weeklyActivities || []), [aggregates.weeklyGroups, aggregates.weeklyActivities]);
  const predictions = useActivityPredictions(weeklyGroups, { windowSize: predWindow, ewmaAlpha: predAlpha, blend: predBlend });
  // Use the same recent window as predictions for goal simulation so ETA/slope align with the Forecast controls
  const simulationWindow = weeklyGroups.slice(-predWindow);
  const simulation = useGoalSimulation(simulationWindow, predictions, {
    distanceGoal: simDistanceGoal ? Number(simDistanceGoal) : null,
    paceGoal: simPaceGoal ? Number(simPaceGoal) : null,
    maxWeeks: 104,
  });

  // Determine how many weeks to display based on selected period (1 week = 7 days)
  const weeksToDisplay = Math.min(52, Math.max(1, Math.ceil(periodDays / 7))); // cap at 52 (≈ 1 year)
  // Build displayedWeeksRaw as an exact window of weeks ending at lastRunning.
  // This fills gaps (weeks with no activities) with zeroed entries so charts reflect the selected date range.
  const buildIsoWeekKey = (d) => {
    const dt = new Date(d);
    const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7; // 0 = Monday
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thursday anchor
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
    const year = tmp.getUTCFullYear();
    return `${year}-W${String(week).padStart(2,'0')}`;
  };

  const weeklyMap = new Map(weeklyGroups.map(w => [w.week, w]));
  const displayedWeeksRaw = (() => {
    const out = [];
    for (let i = weeksToDisplay - 1; i >= 0; i--) {
      const d = new Date(lastRunning);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = buildIsoWeekKey(d);
      if (weeklyMap.has(key)) {
        out.push(weeklyMap.get(key));
      } else {
        out.push({ week: key, distance: 0, rollingAvgPace4: null, activeDaysCount: 0 });
      }
    }
    return out;
  })();

  // Aggregation strategy depending on selected period:
  // - <= 3 months (≈ 90 days): keep weekly points
  // - <= 6 months (≈ 180 days): aggregate to ~26 points (bi-weekly)
  // - > 6 months (up to 1 year): aggregate to ~12 points (monthly-like)
  const aggregateWeeks = (weeksArr, maxPoints) => {
    if (!weeksArr || weeksArr.length <= maxPoints) return weeksArr;
    const windowSize = Math.ceil(weeksArr.length / maxPoints);
    const out = [];
    for (let i = 0; i < weeksArr.length; i += windowSize) {
      const slice = weeksArr.slice(i, i + windowSize);
      const distance = slice.reduce((s, w) => s + (w.distance != null ? w.distance : (w.total_distance_km != null ? w.total_distance_km : 0)), 0);
      const paceVals = slice.map(w => (w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace != null ? w.avg_pace : null))).filter(v => v != null);
      const rollingAvgPace4 = paceVals.length ? (paceVals.reduce((s, v) => s + v, 0) / paceVals.length) : null;
      const activeDays = slice.reduce((s, w) => s + (w.activeDays || w.active_days || w.active_days_count || 0), 0);
      const firstLabel = slice[0]?.week || '';
      const lastLabel = slice[slice.length-1]?.week || '';
      const label = slice.length === 1 ? firstLabel : (firstLabel && lastLabel ? `${firstLabel} → ${lastLabel}` : firstLabel || lastLabel);
      out.push({ week: label, distance, rollingAvgPace4, activeDays });
    }
    return out;
  };

  const rawLen = displayedWeeksRaw.length;
  let maxPointsForDisplay = rawLen;
  if (periodDays <= 90) {
    maxPointsForDisplay = rawLen; // weekly
  } else if (periodDays <= 180) {
    maxPointsForDisplay = Math.min(26, rawLen); // bi-weekly-ish
  } else {
    maxPointsForDisplay = Math.min(12, rawLen); // monthly-like
  }

  // Prefer server-provided weekly aggregates when available (more complete/normalized).
  // If server returns an empty array (present but no data), fall back to client-side `displayedWeeksRaw`.
  const serverWeekly = (runningAnalysis && Array.isArray(runningAnalysis.weekly) && runningAnalysis.weekly.length > 0) ? runningAnalysis.weekly : null;
  const normalizedServerWeeks = serverWeekly ? serverWeekly.map(w => ({
    week: w.week,
    distance: w.total_distance_km ?? w.totalDistance ?? w.distance ?? 0,
    rollingAvgPace4: w.avg_pace ?? w.rollingAvgPace4 ?? null,
    activeDays: w.active_days ?? w.activeDays ?? w.active_days_count ?? 0
  })) : null;
  const usedWeeks = normalizedServerWeeks ? normalizedServerWeeks.slice(0, maxPointsForDisplay).reverse() : displayedWeeksRaw;
  const displayedWeeksFinal = aggregateWeeks(usedWeeks, maxPointsForDisplay);
  // Expose as `displayedWeeks` for backwards-compatible template usage
  const displayedWeeks = displayedWeeksFinal;
  const distanceSeries = displayedWeeks.map((w, i) => ({ value: w.distance != null ? w.distance : (w.total_distance_km ?? 0), label: w.week || `W${i+1}` }));
  const paceSeries = displayedWeeks.map((w, i) => ({ value: w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace ?? null), label: w.week || `W${i+1}` }));

  // Correlations for running-specific metrics (pearson only for now)
  const [corrThreshold, setCorrThreshold] = React.useState(() => {
    try {
      const raw = localStorage.getItem('runningMinAbsR');
      const v = parseFloat(raw);
      return (!Number.isNaN(v) && v >= 0 && v <= 1) ? v : 0.85;
    } catch (e) {
      return 0.85;
    }
  });

  // persist min |r| selection so user preference survives reloads
  React.useEffect(() => {
    try { localStorage.setItem('runningMinAbsR', String(corrThreshold)); } catch (e) { /* ignore */ }
  }, [corrThreshold]);
  // Always use the server full correlation matrix here (no selector)
  const corrSource = 'full';
  // Fixed color scheme (selector removed)
  const corrColorScheme = 'rg';
  const runningCorrelations = React.useMemo(() => {
  // include rr and vertical ratio metrics requested by user so they appear in heatmap & correlations
  // also include avg_vertical_oscillation (common DB/device field)
  const fields = ['distance_km', 'duration_min', 'calories', 'avg_pace', 'avg_rr', 'max_rr', 'avg_vertical_ratio', 'avg_vertical_oscillation'];
    const rows = runningActivities.map(a => {
      const d = a.distance_km != null ? Number(a.distance_km) : null;
      const cal = a.calories != null ? Number(a.calories) : null;
      // Prefer DB pace column (various possible names) and parse it; otherwise fall back to duration-based
  const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      const parsedPace = rawPace != null ? parsePaceToMinutes(rawPace) : null;
      const dur = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
      const pace = parsedPace != null ? parsedPace : paceMinPerKm(d, dur);
      // respiratory rate (RR) — try several common keys
      const avgRr = a.avg_rr ?? a.avgRr ?? a.rr_avg ?? a.avg_rr_ms ?? null;
      const maxRr = a.max_rr ?? a.maxRr ?? a.rr_max ?? null;
      // vertical ratio / oscillation — accept several possible device/DB keys
      const avgVerticalRatio = a.avg_vertical_ratio
        ?? a.vertical_ratio
        ?? a.vertical_osc
        ?? a.avg_vertical_osc
        ?? a.avg_vertical_oscillation
        ?? a.avg_vertical_oscillation_cm
        ?? a.vertical_oscillation
        ?? a.avg_vertical_ratio_pct
        ?? null;
  return {
    distance_km: Number.isFinite(d) ? d : null,
    duration_min: dur,
    calories: Number.isFinite(cal) ? cal : null,
    avg_pace: Number.isFinite(pace) ? pace : null,
    avg_rr: Number.isFinite(Number(avgRr)) ? Number(avgRr) : null,
    max_rr: Number.isFinite(Number(maxRr)) ? Number(maxRr) : null,
    avg_vertical_ratio: Number.isFinite(Number(avgVerticalRatio)) ? Number(avgVerticalRatio) : null
  };
    });

    function pearson(xs, ys) {
      const x = [];
      const y = [];
      for (let i = 0; i < xs.length; i++) {
        const xv = xs[i]; const yv = ys[i];
        if (xv == null || yv == null) continue;
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
        x.push(xv); y.push(yv);
      }
      const n = x.length;
      if (n < 2) return null;
      const mean = arr => arr.reduce((s,v)=>s+v,0)/arr.length;
      const mx = mean(x); const my = mean(y);
      let num = 0, sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - mx; const dy = y[i] - my;
        num += dx * dy; sx += dx*dx; sy += dy*dy;
      }
      const denom = Math.sqrt(sx * sy);
      if (denom === 0) return null;
      return num / denom;
    }

    const matrix = {};
    fields.forEach(a => {
      matrix[a] = {};
      fields.forEach(b => {
        const va = rows.map(r => r[a]);
        const vb = rows.map(r => r[b]);
        const v = pearson(va, vb);
        matrix[a][b] = v == null ? null : Number(v);
      });
    });

    const sig = [];
    for (let i = 0; i < fields.length; i++) {
      for (let j = i+1; j < fields.length; j++) {
        const a = fields[i]; const b = fields[j];
        const v = matrix[a][b];
        if (v != null && Math.abs(v) >= (corrThreshold || 0)) {
          sig.push({ field1: a, field2: b, correlation: v, method: 'pearson' });
        }
      }
    }

    return { correlations: { pearson: matrix }, significant_correlations: sig, data_points: rows.length };
  }, [runningActivities, corrThreshold]);

  // Build distilled stats for Recommendations card (dynamic, derived from visible data only)
  const recommendationsData = React.useMemo(() => {
    // Select correlation matrix actually displayed (server full preferred)
    let raw = (runningAnalysis?.correlations_full) || runningCorrelations.correlations.pearson;
    const metrics = raw ? Object.keys(raw) : [];
    const pairs = [];
    metrics.forEach(a => {
      metrics.forEach(b => {
        if (a >= b) return; // avoid duplicates & self
        const v = raw?.[a]?.[b];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          pairs.push({ a, b, r: v, abs: Math.abs(v) });
        }
      });
    });
    const topPairs = pairs
      .filter(p => p.abs >= (corrThreshold || 0))
      .sort((x, y) => y.abs - x.abs)
      .slice(0, 3);

    // Weekly load progression (distance) - last 4 vs previous 4 weeks from client displayedWeeksRaw or weeklyGroups
    const weeks = weeklyGroups || [];
    const last4 = weeks.slice(-4);
    const prev4 = weeks.slice(-8, -4);
    const sumDist = arr => arr.reduce((s, w) => s + (w.distance != null ? w.distance : (w.total_distance_km ?? 0) || 0), 0);
    const last4Dist = sumDist(last4);
    const prev4Dist = sumDist(prev4);
    const rampPct = prev4Dist > 0 ? ((last4Dist - prev4Dist) / prev4Dist) * 100 : null;

    // Pace & distance linear regression slopes (already computed in predictions.regression)
    const distSlope = predictions?.regression?.distReg?.slope ?? null; // km per week
    const paceSlope = predictions?.regression?.paceReg?.slope ?? null; // min/km per week (negative is good)

    return {
      topPairs,
      rampPct,
      last4Dist,
      prev4Dist,
      distSlope,
      paceSlope,
      predictedRollingPace: predictions?.predictedRollingPace ?? null,
      predictedDistance: predictions?.predictedDistance ?? null,
      dataPoints: runningCorrelations.data_points,
    };
  }, [runningAnalysis, runningCorrelations, corrThreshold, weeklyGroups, predictions]);

  

  // Period totals (adapt to selected periodDays)
  const periodTotals = React.useMemo(() => {
    try {
      return runningActivities.reduce((t, a) => {
        t.distance += Number(a.distance_km) || 0;
        t.durationMin += Number(a.duration_min) || 0;
        t.calories += Number(a.calories) || 0;
        return t;
      }, { distance: 0, durationMin: 0, calories: 0 });
    } catch (e) {
      return { distance: 0, durationMin: 0, calories: 0 };
    }
  }, [runningActivities]);

  const avgPerDay = React.useMemo(() => ({
    distance: (periodTotals.distance || 0) / Math.max(1, Number(periodDays) || 1),
    durationMin: (periodTotals.durationMin || 0) / Math.max(1, Number(periodDays) || 1)
  }), [periodTotals, periodDays]);

  // date range is computed inline where needed; startDate/endDate variables removed per UI simplification

  // DEBUG: log key running data to browser console to investigate pace values (temporary)
  React.useEffect(() => {
    try {
      console.log('DEBUG Running data', {
        periodDays,
        runningActivitiesCount: runningActivities.length,
        runningActivitiesSample: runningActivities.slice(0,5),
        runningAnalysis,
        displayedWeeks
      });
    } catch (e) {
      // ignore
    }
  }, [periodDays, runningActivities, runningAnalysis, displayedWeeks]);

  return (
    <div className="page-container">
      
      <div className="page-header">
        <h1 className="page-title">Running Analytics</h1>
  <p className="page-subtitle">Specialized running metrics: distance, avg_pace, trend forecasts and goal simulations.</p>
        <div className="toolbar flex gap-2 mt-4 flex-wrap items-center">
          <div className="flex gap-2 order-1 items-center">
            {dateRangeMode === 'rolling' && (
              <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))} className="period-select">
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 2 weeks</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 2 months</option>
                <option value={90}>Last 3 months</option>
                <option value={180}>Last 6 months</option>
                <option value={365}>Last 1 year</option>
              </select>
            )}
            {dateRangeMode === 'explicit' && (
              <div className="flex gap-2 items-center text-xs">
                <input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)} className="input input-sm" />
                <span>→</span>
                <input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} className="input input-sm" />
              </div>
            )}
            <Button aria-label="Refresh data" variant="secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</Button>
            <div className="flex items-center gap-2 ml-4 text-xs">
              <select value={dateRangeMode} onChange={e=>setDateRangeMode(e.target.value)} className="select select-sm">
                <option value="rolling">Rolling</option>
                <option value="explicit">Range</option>
              </select>
            </div>
            
          </div>
          <div className="ml-auto flex gap-2 order-3 md:order-2">
            {/* Gym link removed - use Activity quick-links */}
          </div>
        </div>
      </div>
      <div className="page-content space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-2 flex flex-col gap-4">
            <MetricCard
              title={`Distance (${periodDays}d)`}
              value={(periodTotals.distance || 0).toFixed(2)}
              unit="km"
              icon="📏"
              color="indigo"
              subtitle={`Avg ${avgPerDay.distance.toFixed(2)} km/day · ${displayedWeeks.length} w`}
              tooltip={`Sum of running distance over the selected ${periodDays}‑day window`}
            />
            <MetricCard
              title={`Active Minutes (${periodDays}d)`}
              value={((periodTotals.durationMin || 0) / 60).toFixed(1)}
              unit="h"
              icon="⏱️"
              color="yellow"
              subtitle={`Avg ${((avgPerDay.durationMin || 0) / 60).toFixed(1)} h/day`}
              tooltip={`Sum of activity durations over the selected ${periodDays}‑day window (converted to hours)`}
            />
              <MetricCard
              title="Rolling Pace (4w)"
              value={(() => {
                const raw = weeklyGroups[weeklyGroups.length-1]?.rollingAvgPace4;
                const formatted = raw != null ? formatPaceMinPerKm(raw) : '-';
                return raw != null ? `${formatted}` : '-';
              })()}
              unit="Avg Pace"
              icon="🏃"
              color="green"
              subtitle={`Active days: ${aggregates.activeDays} · Streak ${weeklyGroups[weeklyGroups.length-1]?.streakUp ?? 0}`}
              tooltip={`Latest 4-week rolling pace (lower is better).`}
            />
            <MetricCard
              title={dateRangeMode==='explicit' ? 'Runs (range)' : `Runs (${periodDays}d)`}
              value={String(runningActivities.length)}
              unit="runs"
              icon="🏁"
              color="blue"
              subtitle={`Avg ${ (runningActivities.length / Math.max(1, periodDays)).toFixed(2) } runs/day`}
              tooltip={`Average runs per day over the selected ${dateRangeMode==='explicit'?'explicit date range':periodDays+'‑day window'} (client-side)`}
            />
            
          </div>
          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Last {displayedWeeks.length} Weeks Distance</h3>
              <span className="text-[10px] text-gray-500">km</span>
            </div>
            <div className="card-content">
              {distanceSeries.length > 0 ? (
                <WeeklyDistanceChart series={distanceSeries} height={200} rollingWindow={4} />
              ) : <div className="text-xs text-gray-500">No distance data for selected period</div>}
            </div>
          </div>
          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Avg Pace (4w)</h3>
              <span className="text-[10px] text-gray-500">Avg Pace</span>
            </div>
            <div className="card-content">
              {paceSeries.filter(p => p.value != null).length > 1 ? (
                <WeeklyPaceChart
                  series={paceSeries.map(p => ({ label: p.label, weekly: p.value, rolling: p.value }))}
                  height={200}
                />
              ) : <div className="text-xs text-gray-500">Insufficient pace data (need at least 2 weeks)</div>}
            </div>
          </div>
        </div>
        {busy && runningActivities.length === 0 && <LoadingSpinner message="Loading running activities..." />}
        {error && runningActivities.length === 0 && <ErrorMessage message={error} />}

        {runningAnalysis && (
          <>
            <div className="grid grid-cols-1 gap-6">
              <div className="md:col-span-12"><RunningVO2MaxTrend runs={runningAnalysis.runs} trend={runningAnalysis.vo2max_trend} /></div>
            </div>
          </>
        )}

        {/* Pace + HR chart (avg_pace, avg_hr, max_hr) - prefer server runningAnalysis.runs if available */}
        <div className="grid grid-cols-1 gap-6">
          <div className="md:col-span-12 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Pace & HR</h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <label className="text-gray-400">Primary:</label>
                  <select className="select select-sm" value={primaryMetric} onChange={e=>setPrimaryMetric(e.target.value)}>
                    <option value="avg_pace">Avg Pace</option>
                    <option value="avg_steps_per_min">Steps / min</option>
                  </select>
                </div>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showHrZones} onChange={e=>setShowHrZones(e.target.checked)} />
                  <span>HR Zones</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showTrendLines} onChange={e=>setShowTrendLines(e.target.checked)} />
                  <span>Trends</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showAvgLines} onChange={e=>setShowAvgLines(e.target.checked)} />
                  <span>Avg Lines</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={distanceDotScale} onChange={e=>setDistanceDotScale(e.target.checked)} />
                  <span>Size by km</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showAvgHr} onChange={e=>setShowAvgHr(e.target.checked)} />
                  <span>Avg HR</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showMaxHr} onChange={e=>setShowMaxHr(e.target.checked)} />
                  <span>Max HR</span>
                </label>
              </div>
            </div>
            <div className="card-content">
                  <PaceHrChart
                    runs={(runningAnalysis && Array.isArray(runningAnalysis.runs) && runningAnalysis.runs.length>0) ? runningAnalysis.runs : runningActivities}
                    height={420}
                    primaryMetric={primaryMetric}
                    showHrZones={showHrZones}
                    showTrendLines={showTrendLines}
                    showAvgLines={showAvgLines}
                    distanceDotScale={distanceDotScale}
                    showAvgHr={showAvgHr}
                    showMaxHr={showMaxHr}
                  />
            </div>
          </div>
        </div>

        {/* If server returned no runs, show an action banner */}
        {runningAnalysis && runningAnalysis.runs === 0 && (
          <div className="card mt-4">
            <div className="card-content flex items-center justify-between">
              <div className="text-sm text-gray-600">No running activities found in the selected period.</div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" onClick={handleIncreasePeriod}>Show last 90 days</Button>
                <div className="text-xs text-gray-500">Or add running activities / check data source</div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header flex flex-wrap gap-3 items-center justify-between">
            <h3 className="card-title">Distance vs Rolling Pace Trend</h3>
            <div className="text-[11px] text-gray-500">Lower pace = better · Rolling pace = 4w avg</div>
          </div>
            <div className="card-content">
            <TrendComparison
              height={220}
              data={displayedWeeks.map(w => ({
                label: w.week,
                distance: (w.distance != null ? w.distance : (w.total_distance_km ?? 0)),
                rollingPace: (w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace ?? null))
              }))}
              forecast={{ distance: predictions.predictedDistance, rollingPace: predictions.predictedRollingPace }}
            />
          </div>
        </div>

        {runningActivities.length > 0 && (
          <div className="card">
            <div className="card-header flex items-center justify-between flex-wrap gap-3">
              <h3 className="card-title">Distance Buckets (5–25 km) Pace & Correlations</h3>
              <div className="text-[11px] text-gray-500">Runs ~5/10/15/20/25 km (±1 km)</div>
            </div>
            <div className="card-content">
              <DistanceBucketComparison activities={runningActivities} />
            </div>
          </div>
        )}

        <div className="card">
            <div className="card-header flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="card-title">Running Correlations</h3>
              <span className="hidden md:inline text-[11px] text-gray-500">Pairwise Pearson correlations for running activities (source: full)</span>
            </div>
            {/* Color scale selector removed — using default 'rg' */}
          </div>
          <div className="card-content grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap gap-4 items-center text-[11px]">
                <div className="flex items-center gap-2">
                  <label className="text-gray-500 uppercase tracking-wide text-[10px]">Min |r|</label>
                  <input type="range" min={0} max={1} step={0.05} value={corrThreshold} onChange={e=>setCorrThreshold(Number(e.target.value))} />
                  <span className="text-xs tabular-nums">{corrThreshold.toFixed(2)}</span>
                </div>
                {/* Source selector removed — always using server 'full' matrix */}
              </div>
              <div className="rounded-lg ring-1 ring-slate-800/60 p-2 bg-gradient-to-b from-slate-950 to-slate-900">
                {(() => {
                  // Select raw matrix based on source
                  let raw = corrSource === 'full'
                    ? (runningAnalysis?.correlations_full || null)
                    : corrSource === 'extended'
                      ? (runningAnalysis?.correlations_extended || null)
                      : runningCorrelations.correlations.pearson;

                  // If we requested server full but it's missing, inform user
                  if (corrSource === 'full' && !raw) {
                    return <div className="text-[11px] text-gray-500 px-2 py-3">No server full correlation matrix returned.</div>;
                  }

                  // Prune all-null columns/rows (server may include fields with no overlap)
                  if (raw) {
                    try {
                      const metrics = Object.keys(raw || {});
                      const keep = metrics.filter(m => Object.values(raw[m] || {}).some(v => typeof v === 'number'));
                      if (keep.length && keep.length < metrics.length) {
                        const pruned = {};
                        keep.forEach(a => {
                          pruned[a] = {};
                          keep.forEach(b => { pruned[a][b] = raw[a]?.[b] ?? null; });
                        });
                        raw = pruned;
                      }
                      if (!keep.length) raw = null;
                    } catch (e) { /* ignore pruning issues */ }
                  }

                  if (!raw) {
                    return <div className="text-[11px] text-gray-500 px-2 py-3">Full matrix has no overlapping numeric pairs to compute correlations.</div>;
                  }

                  return (
                    <CorrelationHeatmap
                      matrix={raw}
                      method="pearson"
                      title={corrSource === 'full' ? 'Full Correlations' : corrSource === 'extended' ? 'Extended Correlations' : 'Pearson matrix'}
                      compact={true}
                      shrinkToContent={true}
                      cellSize={corrSource === 'full' ? 34 : 48}
                      showLegend={false}
                      colorScheme={corrColorScheme}
                    />
                  );
                })()}
              </div>
            </div>
            <div className="space-y-4">
              {/* CorrelationMatrix removed to avoid duplicating items shown in the Full correlation list below */}
              {/* Full styled correlation list (mirrors CorrelationMatrix items) */}
              <div>
                <h4 className="font-semibold mb-1">Full correlation list</h4>
                <div className="text-[11px] text-gray-400 mb-2">All pairs with |r| ≥ {corrThreshold.toFixed(2)}</div>
                <div className="space-y-3">
                  {
                    (() => {
                      // select raw matrix according to corrSource (same logic as heatmap above)
                      let raw = corrSource === 'full'
                        ? (runningAnalysis?.correlations_full || null)
                        : corrSource === 'extended'
                          ? (runningAnalysis?.correlations_extended || null)
                          : runningCorrelations.correlations.pearson;

                      if (corrSource === 'full' && !raw) {
                        return <div className="text-[11px] text-gray-500 px-2 py-3">No server full correlation matrix returned.</div>;
                      }

                      // prune rows/cols with all nulls
                      if (raw) {
                        try {
                          const metrics = Object.keys(raw || {});
                          const keep = metrics.filter(m => Object.values(raw[m] || {}).some(v => typeof v === 'number'));
                          if (keep.length && keep.length < metrics.length) {
                            const pruned = {};
                            keep.forEach(a => {
                              pruned[a] = {};
                              keep.forEach(b => { pruned[a][b] = raw[a]?.[b] ?? null; });
                            });
                            raw = pruned;
                          }
                          if (!keep.length) raw = null;
                        } catch (e) { /* ignore pruning issues */ }
                      }

                      if (!raw) {
                        return <div className="text-[11px] text-gray-500 px-2 py-3">Full matrix has no overlapping numeric pairs to compute correlations.</div>;
                      }

                      // build pairs
                      const rows = [];
                      const metrics = Object.keys(raw || {});
                      metrics.forEach(a => {
                        const row = raw[a] || {};
                        metrics.forEach(b => {
                          if (a === b) return;
                          const val = row[b];
                          if (val == null || Number.isNaN(val)) return;
                          // only include each unordered pair once (a < b)
                          if (a < b) rows.push({ field1: a, field2: b, correlation: Number(val) });
                        });
                      });

                      // filter by threshold and sort
                      const list = rows.filter(c => Math.abs(c.correlation || 0) >= (corrThreshold || 0))
                        .sort((x,y) => Math.abs(y.correlation) - Math.abs(x.correlation));

                      // helper formatters (copied from CorrelationMatrix)
                      const formatFieldName = (fieldName) => fieldName
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                        .replace('Rhr', 'RHR')
                        .replace('Hr', 'HR');
                      const getCorrelationStrength = (correlation) => {
                        const abs = Math.abs(correlation);
                        if (abs >= 0.7) return 'strong';
                        if (abs >= 0.5) return 'moderate';
                        if (abs >= 0.3) return 'weak';
                        return 'negligible';
                      };
                      const getCorrelationColor = (correlation, strength) => {
                        if (strength === 'negligible') return '#6b7280';
                        if (correlation >= 0) {
                          if (strength === 'strong') return '#059669';
                          if (strength === 'moderate') return '#10b981';
                          return '#34d399';
                        } else {
                          if (strength === 'strong') return '#dc2626';
                          if (strength === 'moderate') return '#ef4444';
                          return '#f87171';
                        }
                      };

                      return list.map((item, idx) => {
                        const strength = getCorrelationStrength(item.correlation);
                        const direction = item.correlation >= 0 ? 'positive' : 'negative';
                        const absCorrelation = Math.abs(item.correlation || 0);
                        return (
                          <div key={idx} className="correlation-item" style={{ padding: 16, background: 'transparent', border: '1px solid rgba(226,232,240,0.08)', borderRadius: 8 }}>
                            <div className="correlation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div className="correlation-fields" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="field-name" style={{ fontWeight: 600, color: '#e6eef8', background: '#0f1724', padding: '4px 8px', borderRadius: 6 }}>{formatFieldName(item.field1)}</span>
                                <div className="correlation-arrow">{direction === 'positive' ? '↗️' : '↘️'}</div>
                                <span className="field-name" style={{ fontWeight: 600, color: '#e6eef8', background: '#0f1724', padding: '4px 8px', borderRadius: 6 }}>{formatFieldName(item.field2)}</span>
                              </div>
                              <div className="correlation-value-container" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="method-badge" style={{ padding: '4px 6px', borderRadius: 6, background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700 }}>{'P'}</div>
                                <div className="correlation-value" style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'Monaco, Menlo, monospace', color: getCorrelationColor(item.correlation, strength) }}>{item.correlation.toFixed(3)}</div>
                                <div className={`strength-badge ${strength}`} style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{strength.toUpperCase()}</div>
                              </div>
                            </div>

                            <div className="correlation-bar-container" style={{ marginBottom: 8 }}>
                              <div className="correlation-bar" style={{ width: '100%', height: 8, background: '#0b1220', borderRadius: 4, overflow: 'hidden' }}>
                                <div className="correlation-fill" style={{ width: `${absCorrelation * 100}%`, height: '100%', backgroundColor: getCorrelationColor(item.correlation, strength) }}></div>
                              </div>
                            </div>

                            <div className="correlation-description" style={{ color: '#94a3b8', fontSize: 13 }}>
                              {`${formatFieldName(item.field1)} is ${strength === 'strong' ? 'strongly' : strength === 'moderate' ? 'moderately' : strength === 'weak' ? 'weakly' : 'slightly'} ${item.correlation >= 0 ? 'positively' : 'negatively'} correlated with ${formatFieldName(item.field2)}`}{(lowerIsBetterNote(item.field1) || lowerIsBetterNote(item.field2))}
                            </div>
                          </div>
                        );
                      });
                    })()
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-4">
            <h3 className="card-title">Forecast Controls</h3>
            <div className="text-[11px] text-gray-500">Blend = regression vs EWMA weight · α = smoothing factor</div>
          </div>
          <div className="card-content grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-4 flex gap-6 flex-wrap text-xs mb-2">
              <div>
                <label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">Window</label>
                <select value={predWindow} onChange={e=>setPredWindow(Number(e.target.value))} className="select select-sm">
                  {[4,5,6,7,8,9,10,12].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">Blend</label>
                <input aria-label="Blend ratio" type="range" min={0} max={1} step={0.05} value={predBlend} onChange={e=>setPredBlend(Number(e.target.value))} />
                <div className="text-[10px] text-gray-500">{(predBlend*100).toFixed(0)}% regression</div>
              </div>
              <div>
                <label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">EWMA α</label>
                <input aria-label="EWMA alpha" type="range" min={0.1} max={0.9} step={0.05} value={predAlpha} onChange={e=>setPredAlpha(Number(e.target.value))} />
                <div className="text-[10px] text-gray-500">α={predAlpha.toFixed(2)}</div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Distance Forecast</div>
              <div className="text-lg font-semibold">{predictions.predictedDistance != null ? predictions.predictedDistance.toFixed(2)+' km' : '—'}</div>
              <div className="text-xs text-gray-500">Conf: {predictions.distanceConfidence}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Steps Forecast</div>
              <div className="text-lg font-semibold">{predictions.predictedSteps != null ? predictions.predictedSteps.toFixed(0) : '—'}</div>
              <div className="text-xs text-gray-500">Conf: {predictions.stepsConfidence}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Rolling Pace Forecast</div>
              <div className="text-lg font-semibold">{
                predictions.predictedRollingPace != null
                  ? (formatPaceMinPerKm(predictions.predictedRollingPace) || predictions.predictedRollingPace.toFixed(2)) + ' min/km'
                  : '—'
              }</div>
              <div className="text-xs text-gray-500">{predictions.paceImprovement != null ? (predictions.paceImprovement>0?'+':'')+predictions.paceImprovement.toFixed(1)+'% vs last' : ''}</div>
              <div className="text-xs text-gray-500">Conf: {predictions.paceConfidence}</div>
            </div>
            <div className="text-[10px] text-gray-500 md:col-span-1">Regression blend (linear trend) + EWMA (smoothing). Lower pace = better.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3">
            <h3 className="card-title">Goal Simulation</h3>
            <div className="flex gap-4 flex-wrap text-xs">
              <div>
                <label className="block text-gray-500 mb-1">Distance Goal (km)</label>
                <input type="number" min={0} step={0.5} value={simDistanceGoal} onChange={e=>setSimDistanceGoal(e.target.value)} className="input input-sm w-28" placeholder="e.g. 70" />
              </div>
              <div>
                <label className="block text-gray-500 mb-1">Rolling Pace Goal</label>
                <input type="number" min={0} step={0.1} value={simPaceGoal} onChange={e=>setSimPaceGoal(e.target.value)} className="input input-sm w-28" placeholder="e.g. 5.10" />
              </div>
            </div>
          </div>
          <div className="card-content grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Distance Projection</h4>
              {simDistanceGoal ? (
                simulation.distance ? (
                  <div className="space-y-1 text-sm">
                    <div>Goal: <strong>{simDistanceGoal} km</strong></div>
                    <div>Status: {simulation.distance.message}</div>
                    {simulation.distance.weeks != null && <div>Weeks: <strong>{simulation.distance.weeks}</strong></div>}
                    {simulation.distance.etaDate && <div>ETA: {simulation.distance.etaDate.toISOString().slice(0,10)}</div>}
                    <div className="text-xs text-gray-500">Slope: {predictions.regression.distReg?.slope?.toFixed(2) || '-'} km/wk</div>
                  </div>
                ) : <div className="text-sm text-gray-500">No data.</div>
              ) : <div className="text-sm text-gray-500">Enter distance goal.</div>}
            </div>
            <div>
              <h4 className="font-semibold mb-2">Pace Projection</h4>
              {simPaceGoal ? (
                simulation.pace ? (
                  <div className="space-y-1 text-sm">
                    <div>Goal: <strong>{simPaceGoal} min/km</strong></div>
                    <div>Status: {simulation.pace.message}</div>
                    {simulation.pace.weeks != null && <div>Weeks: <strong>{simulation.pace.weeks}</strong></div>}
                    {simulation.pace.etaDate && <div>ETA: {simulation.pace.etaDate.toISOString().slice(0,10)}</div>}
                    <div className="text-xs text-gray-500">Slope: {predictions.regression.paceReg?.slope?.toFixed(3) || '-'} min/km/wk</div>
                  </div>
                ) : <div className="text-sm text-gray-500">No data.</div>
              ) : <div className="text-sm text-gray-500">Enter pace goal.</div>}
            </div>
            <div className="md:col-span-2 text-[10px] text-gray-500 flex flex-wrap gap-4">
              <span>Linear projection – does not account for adaptation, injury or taper.</span>
              <span className="text-indigo-600">Slope dist: {predictions.regression?.distReg?.slope?.toFixed?.(2) || '-' } km/wk</span>
              <span className="text-green-600">Slope pace: {predictions.regression?.paceReg?.slope?.toFixed?.(3) || '-' } min/km/wk</span>
            </div>
          </div>
        </div>
  {(runningAnalysis?.running_economy || (runningCorrelations && runningCorrelations.data_points > 0)) && (
          (() => {
            // Prefer server-provided focus_rankings but merge any missing metrics computed client-side
            const serverEco = runningAnalysis?.running_economy || {};
            const serverFocus = Array.isArray(serverEco.focus_rankings) ? serverEco.focus_rankings.slice() : [];
            // Build client-side focus entries from runningCorrelations (correlation vs avg_pace)
            const clientPairs = [];
            try {
              const pear = runningCorrelations.correlations.pearson || {};
              Object.keys(pear).forEach(k => {
                const v = pear[k]?.avg_pace ?? pear['avg_pace']?.[k] ?? null;
                if (v != null && !Number.isNaN(v)) {
                  clientPairs.push({ metric: k, r_vs_pace: v, direction: v < 0 ? 'inverse' : 'direct' });
                }
              });
            } catch (e) { /* ignore */ }

            // Merge, preferring server values, but ensure requested metrics are present.
            // Some backends/devices may use avg_vertical_oscillation instead of avg_vertical_ratio.
            const aliases = {
              'avg_rr': ['avg_rr','avgRr','rr_avg','avg_rr_ms'],
              'max_rr': ['max_rr','maxRr','rr_max'],
              'avg_vertical_ratio': ['avg_vertical_ratio','avg_vertical_ratio_pct','avg_vertical_oscillation','avg_vertical_osc','vertical_oscillation','vertical_osc']
            };
            Object.keys(aliases).forEach(target => {
              if (serverFocus.some(f => f.metric === target)) return; // already present
              const found = clientPairs.find(p => aliases[target].includes(p.metric));
              if (found) {
                // push a normalized entry with the target metric name so UI shows expected label
                serverFocus.push({ metric: target, r_vs_pace: found.r_vs_pace, direction: found.direction });
              }
            });

            const merged = { ...serverEco, focus_rankings: serverFocus };
            return <RunningEconomyPanel data={merged} />;
          })()
        )}
        {runningAnalysis?.duo_scatter && (
          <RunningDuoScatter duo={runningAnalysis.duo_scatter} />
        )}
        {/* Recommendations Section (refined layout) */}
        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3">
            <h3 className="card-title">Recommendations</h3>
            <div className="text-[11px] text-gray-500">Derived from current page data</div>
          </div>
          <RecommendationsPanel
            data={recommendationsData}
            corrThreshold={corrThreshold}
            formatPace={formatPaceMinPerKm}
          />
        </div>
      </div>
    </div>
  );
};

// Inline component for improved readability & structure
const RecommendationsPanel = ({ data, corrThreshold, formatPace }) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const chipClass = 'px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide';
  const fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d));
  const riskRamp = (() => {
    if (data.rampPct == null) return { label: 'No prior window', color: 'bg-slate-700 text-slate-200' };
    if (data.rampPct > 18) return { label: 'High Ramp', color: 'bg-rose-600/80 text-white' };
    if (data.rampPct > 10) return { label: 'Upper Range', color: 'bg-amber-500/80 text-black' };
    if (data.rampPct >= 0) return { label: 'Controlled', color: 'bg-emerald-600/80 text-white' };
    return { label: 'Reduced', color: 'bg-indigo-600/80 text-white' };
  })();
  const paceTrend = (() => {
    if (data.paceSlope == null) return { label: 'No Data', color: 'bg-slate-700 text-slate-200' };
    if (data.paceSlope < 0) return { label: 'Improving', color: 'bg-emerald-600/80 text-white' };
    if (data.paceSlope < 0.02) return { label: 'Flat', color: 'bg-amber-500/70 text-black' };
    return { label: 'Slowing', color: 'bg-rose-600/80 text-white' };
  })();
  const distTrend = (() => {
    if (data.distSlope == null) return { label: '—', color: 'bg-slate-700 text-slate-200' };
    if (data.distSlope > 1.2) return { label: 'Fast Build', color: 'bg-amber-500/80 text-black' };
    if (data.distSlope > 0.5) return { label: 'Healthy Build', color: 'bg-emerald-600/80 text-white' };
    if (data.distSlope >= 0) return { label: 'Stable', color: 'bg-slate-600/70 text-white' };
    return { label: 'Decline', color: 'bg-indigo-600/80 text-white' };
  })();

  const nicename = (f) => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const interpretPair = (p) => {
    const { a, b, r } = p;
    const niceA = nicename(a); const niceB = nicename(b);
    if ((a === 'avg_pace' && b === 'distance_km') || (b === 'avg_pace' && a === 'distance_km')) {
      return r > 0
        ? 'Higher volume aligns with slower avg pace → safeguard efficiency (add quality, keep easy easy).'
        : 'Volume increases align with faster pace → continue gradual build with recovery focus.';
    }
    if ((a === 'duration_min' && b === 'avg_pace') || (b === 'duration_min' && a === 'avg_pace')) {
      return r > 0
        ? 'Longer runs trend slower → monitor fueling & aerobic decoupling.'
        : 'Long durations maintain pace → strong endurance stability.';
    }
    if ((a === 'calories' && b === 'distance_km') || (b === 'calories' && a === 'distance_km')) {
      return 'Calories scale with distance → load tracking consistent.';
    }
    // Respiratory rate (avg_rr / max_rr) interpretations
    if ((a === 'avg_rr' || a === 'max_rr' || b === 'avg_rr' || b === 'max_rr')) {
      const rrKey = (a === 'avg_rr' || a === 'max_rr') ? a : b;
      const other = rrKey === a ? b : a;
      // If RR correlates with pace or distance, surface actionable guidance
      if (other === 'avg_pace' || other === 'distance_km' || other === 'duration_min') {
        if (r > 0) return `${nicename(rrKey)} increases with ${nicename(other)} → may indicate higher respiratory load (fatigue/effort). Consider pacing, breathing drills and recovery.`;
        return `${nicename(rrKey)} decreases as ${nicename(other)} increases → unexpected pattern; verify device data or consider individual breathing economy.`;
      }
      if (other === 'avg_hr' || other === 'max_hr') {
        return `${nicename(rrKey)} tracks with heart rate → both reflect physiological load; use together to monitor intensity and recovery.`;
      }
      // fallback
      return `${nicename(rrKey)} shows a ${Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.5 ? 'moderate' : 'noticeable'} relation with ${niceB === nicename(rrKey) ? nicename(a) : nicename(b)}.`;
    }

    // Vertical ratio / oscillation interpretations
    if (a === 'avg_vertical_ratio' || b === 'avg_vertical_ratio' || a === 'avg_vertical_oscillation' || b === 'avg_vertical_oscillation') {
      const vr = (a === 'avg_vertical_ratio' || a === 'avg_vertical_oscillation') ? a : b;
      const other = vr === a ? b : a;
      if (other === 'avg_pace' || other === 'distance_km') {
        if (r > 0) return `Higher ${nicename(vr)} associates with slower pace → may indicate excessive bounce/inefficient form. Try cadence/form drills and focus on reducing vertical oscillation.`;
        return `Lower ${nicename(vr)} associates with better ${niceB === nicename(vr) ? nicename(a) : nicename(b)} → improved running economy.`;
      }
      return `${nicename(vr)} shows a ${Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.5 ? 'moderate' : 'weak'} relation with ${niceB === nicename(vr) ? nicename(a) : nicename(b)}.`;
    }
    const abs = Math.abs(r);
    const strength = abs >= 0.7 ? 'strong' : abs >= 0.5 ? 'moderate' : 'weak';
    return `${strength} ${r >= 0 ? 'positive' : 'negative'} relation between ${niceA} & ${niceB}.`;
  };

  return (
    <div className="space-y-6">
      {data.dataPoints < 6 && (
        <div className="text-[11px] text-amber-500">Limited data (&lt; 6 runs) – trends may be noisy.</div>
      )}
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Volume (Last 4w)</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold">{fmt(data.last4Dist,1)} km</span>
            {data.prev4Dist > 0 && (
              <span className="text-[11px] text-gray-500">Prev: {fmt(data.prev4Dist,1)} km</span>
            )}
          </div>
          {data.rampPct != null && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`${chipClass} ${riskRamp.color}`}>{riskRamp.label}</span>
              <span className="font-mono text-xs">{data.rampPct >= 0 ? '+' : ''}{fmt(data.rampPct,1)}%</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Distance Trend</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold">{data.distSlope != null ? `${fmt(data.distSlope)} km/wk` : '—'}</span>
            <span className={`${chipClass} ${distTrend.color}`}>{distTrend.label}</span>
          </div>
          {data.predictedDistance != null && (
            <div className="mt-1 text-[11px] text-gray-400">Forecast: {fmt(data.predictedDistance)} km (blend)</div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Pace Trend</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold">{data.paceSlope != null ? `${fmt(data.paceSlope,3)} min/km/wk` : '—'}</span>
            <span className={`${chipClass} ${paceTrend.color}`}>{paceTrend.label}</span>
          </div>
          {data.predictedRollingPace != null && (
            <div className="mt-1 text-[11px] text-gray-400">Forecast 4w: {formatPace(data.predictedRollingPace)} min/km</div>
          )}
        </div>
      </div>

      {/* Correlations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Correlation Highlights</h4>
          <span className="text-[10px] text-gray-500">|r| ≥ {corrThreshold.toFixed(2)}</span>
        </div>
        {data.topPairs.length === 0 && (
          <div className="text-[12px] text-gray-500">No strong relationships at current threshold.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.topPairs.map((p, idx) => {
            const abs = Math.abs(p.r);
            const strength = abs >= 0.7 ? 'Strong' : abs >= 0.5 ? 'Moderate' : 'Weak';
            const color = p.r >= 0 ? (abs >= 0.7 ? 'from-emerald-600 to-emerald-500' : 'from-emerald-500 to-emerald-400') : (abs >= 0.7 ? 'from-rose-600 to-rose-500' : 'from-rose-500 to-rose-400');
            return (
              <div key={idx} className="relative p-3 rounded-lg border border-slate-700/60 bg-slate-900/60 overflow-hidden">
                <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${color}`} />
                <div className="relative space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">r={p.r.toFixed(2)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-gray-200">{strength}</span>
                  </div>
                  <div className="text-[11px] leading-snug text-gray-300">{interpretPair(p)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div>
        <h4 className="font-semibold mb-2">Action Focus (Next 2 Weeks)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Load Management</div>
            <ul className="text-[13px] list-disc ml-5 space-y-1">
              <li>Maintain weekly ramp &lt;8% if prior build was aggressive.</li>
              <li>Plan 1 consolidation week if ramp &gt;18%.</li>
              <li>Monitor fatigue if distance slope &gt;1.2 km/wk.</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Performance & Pace</div>
            <ul className="text-[13px] list-disc ml-5 space-y-1">
              <li>Include 1 tempo / cruise session + 1 neuromuscular (strides/hills).</li>
              <li>Keep easy days distinctly below aerobic threshold.</li>
              <li>Fuel long runs to reduce pace fade (&gt;5% drift).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Advanced toggle */}
      <div className="pt-2 border-t border-slate-700/50">
        <button
          type="button"
          className="text-[11px] px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 transition border border-slate-600/60"
          onClick={() => setShowAdvanced(s => !s)}
          aria-expanded={showAdvanced}
        >{showAdvanced ? 'Hide Advanced Details' : 'Show Advanced Details'}</button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-gray-400">
            <div className="space-y-1">
              <div className="font-semibold text-gray-300">Key Numbers</div>
              <div>Data points: {data.dataPoints}</div>
              <div>Ramp %: {data.rampPct != null ? fmt(data.rampPct,1)+'%' : '—'}</div>
              <div>Dist slope: {data.distSlope != null ? fmt(data.distSlope)+' km/wk' : '—'}</div>
              <div>Pace slope: {data.paceSlope != null ? fmt(data.paceSlope,3)+' min/km/wk' : '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-gray-300">Interpretation Guide</div>
              <div>Ramp 0–10%: controlled</div>
              <div>Ramp 10–18%: upper range</div>
              <div>Ramp &gt;18%: high risk</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-gray-300">Method Notes</div>
              <div>Correlations: Pearson on visible run fields.</div>
              <div>Pace: lower min/km = faster.</div>
              <div>Trends: linear blend + EWMA forecasts.</div>
            </div>
          </div>
        )}
      </div>
      <div className="text-[10px] text-gray-500">Fields: distance_km · duration_min · calories · avg_pace. Refresh after more runs to refine signals.</div>
    </div>
  );
};

export default Running;
