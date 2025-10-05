import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useActivityAggregates from '../hooks/useActivityAggregates';
import useActivityPredictions from '../hooks/useActivityPredictions';
import useGoalSimulation from '../hooks/useGoalSimulation';
import TrendComparison from '../components/TrendComparison';
// SegmentedControl not used here
// import SegmentedControl from '../components/SegmentedControl';
import Sparkline from '../components/Sparkline';
import MetricCard from '../components/MetricCard';
import CorrelationMatrix from '../components/CorrelationMatrix';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import ScatterPlot from '../components/ScatterPlot';
import { formatPaceMinPerKm, paceMinPerKm, durationToMinutes, parsePaceToMinutes } from '../utils/timeUtils';
import { activitiesAPI } from '../services';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import RunningPaceFormPanel from '../components/RunningPaceFormPanel';
import RunningTrainingLoadPanel from '../components/RunningTrainingLoadPanel';
import RunningVO2MaxTrend from '../components/RunningVO2MaxTrend';
import RunningDuoScatter from '../components/RunningDuoScatter';
import RunningEconomyPanel from '../components/RunningEconomyPanel';

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
  const [predWindow, setPredWindow] = useState(8);
  const [predAlpha, setPredAlpha] = useState(0.5);
  const [predBlend, setPredBlend] = useState(0.6);
  const [simDistanceGoal, setSimDistanceGoal] = useState('');
  const [simPaceGoal, setSimPaceGoal] = useState('');
  const [showAggregated, setShowAggregated] = useState(() => {
    try { return localStorage.getItem('runningShowAggregated') !== '0'; } catch (e) { return true; }
  });

  // server-provided running analysis
  const [runningAnalysis, setRunningAnalysis] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('rolling'); // 'rolling' | 'explicit'
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  React.useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        // Load raw activities (for client-side exploration)
        const res = await activitiesAPI.getLatestActivities(limit);
        setAllActivities(res.activities || []);
        // Also request server-side running analytics (enriched)
        try {
          let url = `/api/analytics/running?days=${periodDays}`;
          if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
            url += `&start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
          }
          const runRes = await api.get(url);
          if (runRes && runRes.running_analysis && Array.isArray(runRes.running_analysis.runs)) {
            // Keep a duplicate of enriched runs for display and charts
            setRunningAnalysis(runRes.running_analysis);
          }
        } catch (e) {
          // non-fatal: server may not have endpoint or DB access
          // console.warn('Running analysis fetch failed', e);
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
    try { localStorage.setItem('runningShowAggregated', showAggregated ? '1' : '0'); } catch (e) { console.warn('Failed to persist runningShowAggregated', e); }
  }, [showAggregated]);

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
  const weeklyGroups = (aggregates.weeklyGroups || aggregates.weeklyActivities) || [];
  const predictions = useActivityPredictions(weeklyGroups, { window: predWindow, ewmaAlpha: predAlpha, blend: predBlend });
  const simulation = useGoalSimulation(weeklyGroups, predictions, {
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
      const distance = slice.reduce((s, w) => s + (w.distance || 0), 0);
      const paceVals = slice.map(w => w.rollingAvgPace4).filter(v => v != null);
      const rollingAvgPace4 = paceVals.length ? (paceVals.reduce((s, v) => s + v, 0) / paceVals.length) : null;
      const activeDays = slice.reduce((s, w) => s + (w.activeDays || 0), 0);
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
  const usedWeeks = serverWeekly ? serverWeekly.slice(0, maxPointsForDisplay).reverse() : displayedWeeksRaw;
  const displayedWeeksFinal = aggregateWeeks(usedWeeks, maxPointsForDisplay);
  // Expose as `displayedWeeks` for backwards-compatible template usage
  const displayedWeeks = displayedWeeksFinal;
  const distanceSeries = displayedWeeks.map((w, i) => ({ value: w.total_distance_km ?? w.distance ?? 0, label: w.week || `W${i+1}` }));
  const paceSeries = displayedWeeks.map((w, i) => ({ value: w.avg_pace ?? w.rollingAvgPace4 ?? null, label: w.week || `W${i+1}` }));

  // Correlations for running-specific metrics (pearson only for now)
  const [corrThreshold, setCorrThreshold] = React.useState(0.3);
  const [corrSource, setCorrSource] = React.useState('basic');
  const [corrColorScheme, setCorrColorScheme] = React.useState('rg');
  const [corrShowLegend, setCorrShowLegend] = React.useState(true);
  const runningCorrelations = React.useMemo(() => {
  const fields = ['distance_km', 'duration_min', 'calories', 'avg_pace'];
    const rows = runningActivities.map(a => {
      const d = a.distance_km != null ? Number(a.distance_km) : null;
      const cal = a.calories != null ? Number(a.calories) : null;
      // Prefer DB pace column (various possible names) and parse it; otherwise fall back to duration-based
  const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      const parsedPace = rawPace != null ? parsePaceToMinutes(rawPace) : null;
      const dur = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
      const pace = parsedPace != null ? parsedPace : paceMinPerKm(d, dur);
  return { distance_km: Number.isFinite(d) ? d : null, duration_min: dur, calories: Number.isFinite(cal) ? cal : null, avg_pace: Number.isFinite(pace) ? pace : null };
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

  const scatterPoints = React.useMemo(() => {
    return runningActivities.map(a => {
      const d = a.distance_km != null ? Number(a.distance_km) : null;
      const dur = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
      const pace = paceMinPerKm(d, dur);
      return { x: d, y: pace, label: a.start_time ? new Date(a.start_time).toISOString().slice(0,10) : '' };
    }).filter(p => p.x != null && p.y != null);
  }, [runningActivities]);

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

  // compute displayed date range for UI
  const startDate = dateRangeMode === 'explicit' && rangeStart ? new Date(rangeStart) : new Date(lastRunning - (periodDays * 24 * 60 * 60 * 1000));
  const endDate = dateRangeMode === 'explicit' && rangeEnd ? new Date(rangeEnd) : new Date(lastRunning);

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
  <p className="page-subtitle">Specialized running metrics: distance, pace (min/km), trend forecasts and goal simulations.</p>
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
            <button aria-label="Refresh data" className="btn btn-secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</button>
            <label className="ml-3 flex items-center text-sm">
              <input type="checkbox" checked={showAggregated} onChange={e=>setShowAggregated(e.target.checked)} className="mr-2" />
              Aggregated
            </label>
            <div className="flex items-center gap-2 ml-4 text-xs">
              <select value={dateRangeMode} onChange={e=>setDateRangeMode(e.target.value)} className="select select-sm">
                <option value="rolling">Rolling</option>
                <option value="explicit">Range</option>
              </select>
            </div>
            <div className="ml-2 text-sm text-gray-600">Showing: {startDate.toISOString().slice(0,10)} → {endDate.toISOString().slice(0,10)}</div>
          </div>
          <div className="ml-auto flex gap-2 order-3 md:order-2">
            <Link to="/gym" className="btn btn-outline" title="Go to strength analytics">Gym →</Link>
          </div>
        </div>
      </div>
      <div className="page-content space-y-6">
        {busy && runningActivities.length === 0 && <LoadingSpinner message="Loading running activities..." />}
        {error && runningActivities.length === 0 && <ErrorMessage message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Last {displayedWeeks.length} Weeks Distance</h3>
              <span className="text-[10px] text-gray-500">km</span>
            </div>
            <div className="card-content">
              {distanceSeries.length > 0 ? (
                <Sparkline
                  data={distanceSeries}
                  height={80}
                  stroke="#0ea5e9"
                  fill="rgba(14,165,233,0.15)"
                  tooltipFormatter={(pt,i)=>`${distanceSeries[i].label || 'Week'}: ${pt.value != null ? pt.value.toFixed(2)+' km' : '—'}`}
                />
              ) : (
                <div className="text-xs text-gray-500">No distance data for selected period</div>
              )}
            </div>
          </div>
          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Rolling Pace (4w)</h3>
              <span className="text-[10px] text-gray-500">min/km</span>
            </div>
            <div className="card-content">
              {paceSeries.filter(p => p.value != null).length > 1 ? (
                <Sparkline
                  data={paceSeries}
                  height={80}
                  stroke="#10b981"
                  fill="rgba(16,185,129,0.15)"
                  tooltipFormatter={(pt,i)=>`${paceSeries[i].label || 'Week'}: ${pt.value != null ? (formatPaceMinPerKm(pt.value) + ' min/km') : '—'}`}
                />
              ) : (
                <div className="text-xs text-gray-500">Insufficient pace data (need at least 2 weeks)</div>
              )}
            </div>
          </div>
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
              title="Rolling Pace (4w)"
              value={(() => {
                const raw = weeklyGroups[weeklyGroups.length-1]?.rollingAvgPace4;
                const formatted = raw != null ? formatPaceMinPerKm(raw) : '-';
                return raw != null ? `${formatted}` : '-';
              })()}
              unit="min/km"
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
              subtitle={`${runningActivities.length} runs in selected ${dateRangeMode==='explicit'?'range':periodDays+'d'}`}
              tooltip={`Number of running activities in the selected ${dateRangeMode==='explicit'?'explicit date range':periodDays+'‑day window'} (client-side)`}
            />
            
          </div>
        </div>

        {runningAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4"><RunningPaceFormPanel data={runningAnalysis.pace_form} /></div>
            <div className="md:col-span-4"><RunningTrainingLoadPanel data={runningAnalysis.training_load} /></div>
            <div className="md:col-span-4"><RunningVO2MaxTrend runs={runningAnalysis.runs} trend={runningAnalysis.vo2max_trend} /></div>
          </div>
        )}

        {/* If server returned no runs, show an action banner */}
        {runningAnalysis && runningAnalysis.runs === 0 && (
          <div className="card mt-4">
            <div className="card-content flex items-center justify-between">
              <div className="text-sm text-gray-600">No running activities found in the selected period.</div>
              <div className="flex items-center gap-3">
                <button className="btn btn-sm" onClick={handleIncreasePeriod}>Show last 90 days</button>
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
              data={displayedWeeks.map(w => ({ label: w.week, distance: w.distance, rollingPace: w.rollingAvgPace4 }))}
              forecast={{ distance: predictions.predictedDistance, rollingPace: predictions.predictedRollingPace }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="card-title">Running Correlations</h3>
              <span className="hidden md:inline text-[11px] text-gray-500">Pairwise Pearson correlations for running activities</span>
            </div>
            <div className="flex gap-2 flex-wrap text-[10px] items-center">
              <label className="font-medium">Color scale:</label>
              <select value={corrColorScheme} onChange={e=>setCorrColorScheme(e.target.value)} className="select select-xs">
                <option value="rg">Red/Green</option>
                <option value="diverging">Diverging</option>
              </select>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" className="checkbox checkbox-xs" checked={corrShowLegend} onChange={e=>setCorrShowLegend(e.target.checked)} /> legend
              </label>
            </div>
          </div>
          <div className="card-content grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap gap-4 items-center text-[11px]">
                <div className="flex items-center gap-2">
                  <label className="text-gray-500 uppercase tracking-wide text-[10px]">Min |r|</label>
                  <input type="range" min={0} max={1} step={0.05} value={corrThreshold} onChange={e=>setCorrThreshold(Number(e.target.value))} />
                  <span className="text-xs tabular-nums">{corrThreshold.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-500 uppercase tracking-wide text-[10px]">Source</label>
                  <select value={corrSource} onChange={e=>setCorrSource(e.target.value)} className="select select-xs">
                    <option value="basic">Client</option>
                    <option value="extended" disabled={!runningAnalysis?.correlations_extended}>Server ext</option>
                    <option value="full" disabled={!runningAnalysis?.correlations_full}>Server full</option>
                  </select>
                  {corrSource === 'full' && <span className="text-[10px] text-amber-500">Wide matrix – scroll →</span>}
                </div>
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
                      showLegend={corrShowLegend}
                      colorScheme={corrColorScheme}
                    />
                  );
                })()}
              </div>
            </div>
            <div className="space-y-4">
              <CorrelationMatrix data={runningCorrelations} maxItems={20} minAbs={corrThreshold} selectedMethod={'pearson'} />
              <div>
                <h4 className="font-semibold mb-1">Scatter: Distance vs Pace</h4>
                <ScatterPlot points={scatterPoints} xLabel={'Distance (km)'} yLabel={'Pace (min/km)'} />
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
        {runningAnalysis?.running_economy && (
          <RunningEconomyPanel data={runningAnalysis.running_economy} />
        )}
        {runningAnalysis?.duo_scatter && (
          <RunningDuoScatter duo={runningAnalysis.duo_scatter} />
        )}
      </div>
    </div>
  );
};

export default Running;
