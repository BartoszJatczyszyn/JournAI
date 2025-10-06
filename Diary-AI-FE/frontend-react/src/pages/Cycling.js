import React, { useMemo, useState } from 'react';
// Link import removed (not used in this view)
import useActivityAggregates from '../hooks/useActivityAggregates';
import useActivityPredictions from '../hooks/useActivityPredictions';
import useGoalSimulation from '../hooks/useGoalSimulation';
import TrendComparison from '../components/TrendComparison';
import WeeklyDistanceChart from '../components/WeeklyDistanceChart';
import WeeklyPaceChart from '../components/WeeklyPaceChart';
import MetricCard from '../components/MetricCard';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import { formatPaceMinPerKm, paceMinPerKm, durationToMinutes, parsePaceToMinutes } from '../utils/timeUtils';
import { activitiesAPI } from '../services';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

// Cycling-specific analytics (sport key: 'cycling' or 'Cycling')
const Cycling = () => {
  const sportKey = 'cycling';
  const [allActivities, setAllActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(200);
  const [periodDays, setPeriodDays] = useState(() => {
    const raw = localStorage.getItem('cyclingPeriodDays');
    const parsed = Number(raw);
    return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30;
  });
  const [predWindow, setPredWindow] = useState(() => { try { const raw = localStorage.getItem('cyclingPredWindow'); const v = Number(raw); return Number.isFinite(v) && v > 0 ? v : 8; } catch (e) { return 8; } });
  const [predAlpha, setPredAlpha] = useState(() => { try { const raw = localStorage.getItem('cyclingPredAlpha'); const v = Number(raw); return Number.isFinite(v) ? v : 0.5; } catch (e) { return 0.5; } });
  const [predBlend, setPredBlend] = useState(() => { try { const raw = localStorage.getItem('cyclingPredBlend'); const v = Number(raw); return Number.isFinite(v) ? v : 0.6; } catch (e) { return 0.6; } });
  const [simDistanceGoal, setSimDistanceGoal] = useState('');
  const [simPaceGoal, setSimPaceGoal] = useState('');

  const [analysis, setAnalysis] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('rolling');
  const [rangeStart] = useState('');
  const [rangeEnd] = useState('');
  const [primaryMetric] = useState(() => { try { const raw = localStorage.getItem('cyclingPrimaryMetric'); return raw === 'avg_steps_per_min' ? 'avg_steps_per_min' : 'avg_pace'; } catch (e) { return 'avg_pace'; } });
  React.useEffect(() => { try { localStorage.setItem('cyclingPrimaryMetric', primaryMetric); } catch (e) { /* ignore */ } }, [primaryMetric]);

  React.useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        const res = await activitiesAPI.getLatestActivities(limit);
        setAllActivities(res.activities || []);
        try {
          let url = `/api/analytics/cycling?days=${periodDays}`;
          if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
            url += `&start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
          }
          const runRes = await api.get(url);
          if (runRes && runRes.running_analysis && Array.isArray(runRes.running_analysis.runs)) {
            setAnalysis(runRes.running_analysis);
          }
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error(e);
        setError('Failed to load activities');
      } finally { setBusy(false); }
    };
    load();
  }, [limit, periodDays, dateRangeMode, rangeStart, rangeEnd]);

  React.useEffect(() => { try { localStorage.setItem('cyclingPeriodDays', String(periodDays)); } catch (e) { /* ignore */ } }, [periodDays]);
  React.useEffect(() => { try { localStorage.setItem('cyclingPredWindow', String(predWindow)); } catch (e) { /* ignore */ } }, [predWindow]);
  React.useEffect(() => { try { localStorage.setItem('cyclingPredAlpha', String(predAlpha)); } catch (e) { /* ignore */ } }, [predAlpha]);
  React.useEffect(() => { try { localStorage.setItem('cyclingPredBlend', String(predBlend)); } catch (e) { /* ignore */ } }, [predBlend]);

  React.useEffect(() => {
    const map = { 7: 100, 14: 200, 30: 400, 60: 800, 90: 1000, 180: 1500, 365: 2500 };
    const newLimit = map[periodDays] || 400;
    if (newLimit !== limit) setLimit(newLimit);
  }, [periodDays, limit]);

  const lastSport = React.useMemo(() => {
    const timestamps = allActivities.map(a => {
      try { if ((a.sport || '').toLowerCase() !== sportKey) return null; const t = new Date(a.start_time).getTime(); return Number.isNaN(t) ? null : t; } catch (e) { return null; }
    }).filter(Boolean);
    return timestamps.length ? Math.max(...timestamps) : Date.now();
  }, [allActivities]);

  const sportActivities = useMemo(() => {
    const cutoff = lastSport - (periodDays * 24 * 60 * 60 * 1000);
    return allActivities.filter(a => {
      if (!a.start_time) return false;
      if ((a.sport || '').toLowerCase() !== sportKey) return false;
      const t = new Date(a.start_time).getTime();
      return !Number.isNaN(t) && t >= cutoff && t <= lastSport;
    });
  }, [allActivities, periodDays, lastSport]);

  const aggregates = useActivityAggregates(sportActivities);
  const weeklyGroups = React.useMemo(() => (aggregates.weeklyGroups || aggregates.weeklyActivities || []), [aggregates.weeklyGroups, aggregates.weeklyActivities]);
  const predictions = useActivityPredictions(weeklyGroups, { windowSize: predWindow, ewmaAlpha: predAlpha, blend: predBlend });
  const simulationWindow = weeklyGroups.slice(-predWindow);
  const simulation = useGoalSimulation(simulationWindow, predictions, { distanceGoal: simDistanceGoal ? Number(simDistanceGoal) : null, paceGoal: simPaceGoal ? Number(simPaceGoal) : null, maxWeeks: 104 });

  const weeksToDisplay = Math.min(52, Math.max(1, Math.ceil(periodDays / 7)));
  const buildIsoWeekKey = (d) => {
    const dt = new Date(d);
    const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
    const year = tmp.getUTCFullYear();
    return `${year}-W${String(week).padStart(2,'0')}`;
  };

  const weeklyMap = new Map(weeklyGroups.map(w => [w.week, w]));
  const displayedWeeksRaw = (() => {
    const out = [];
    for (let i = weeksToDisplay - 1; i >= 0; i--) {
      const d = new Date(lastSport);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = buildIsoWeekKey(d);
      if (weeklyMap.has(key)) out.push(weeklyMap.get(key)); else out.push({ week: key, distance: 0, rollingAvgPace4: null, activeDaysCount: 0 });
    }
    return out;
  })();

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
  if (periodDays <= 90) maxPointsForDisplay = rawLen; else if (periodDays <= 180) maxPointsForDisplay = Math.min(26, rawLen); else maxPointsForDisplay = Math.min(12, rawLen);

  const serverWeekly = (analysis && Array.isArray(analysis.weekly) && analysis.weekly.length > 0) ? analysis.weekly : null;
  const normalizedServerWeeks = serverWeekly ? serverWeekly.map(w => ({ week: w.week, distance: w.total_distance_km ?? w.totalDistance ?? w.distance ?? 0, rollingAvgPace4: w.avg_pace ?? w.rollingAvgPace4 ?? null, activeDays: w.active_days ?? w.activeDays ?? w.active_days_count ?? 0 })) : null;
  const usedWeeks = normalizedServerWeeks ? normalizedServerWeeks.slice(0, maxPointsForDisplay).reverse() : displayedWeeksRaw;
  const displayedWeeksFinal = aggregateWeeks(usedWeeks, maxPointsForDisplay);
  const displayedWeeks = displayedWeeksFinal;
  const distanceSeries = displayedWeeks.map((w, i) => ({ value: w.distance != null ? w.distance : (w.total_distance_km ?? 0), label: w.week || `W${i+1}` }));
  const paceSeries = displayedWeeks.map((w, i) => ({ value: w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace ?? null), label: w.week || `W${i+1}` }));

  const [corrThreshold, setCorrThreshold] = React.useState(() => { try { const raw = localStorage.getItem('cyclingMinAbsR'); const v = parseFloat(raw); return (!Number.isNaN(v) && v >= 0 && v <= 1) ? v : 0.85; } catch (e) { return 0.85; } });
  React.useEffect(() => { try { localStorage.setItem('cyclingMinAbsR', String(corrThreshold)); } catch (e) { /* ignore */ } }, [corrThreshold]);
  const corrSource = 'full';
  const corrColorScheme = 'rg';

  const sportCorrelations = React.useMemo(() => {
    const fields = ['distance_km', 'duration_min', 'calories', 'avg_pace', 'avg_rr', 'max_rr', 'avg_vertical_ratio', 'avg_vertical_oscillation'];
    const rows = sportActivities.map(a => {
      const d = a.distance_km != null ? Number(a.distance_km) : null;
      const cal = a.calories != null ? Number(a.calories) : null;
      const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      const parsedPace = rawPace != null ? parsePaceToMinutes(rawPace) : null;
      const dur = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
      const pace = parsedPace != null ? parsedPace : paceMinPerKm(d, dur);
      const avgRr = a.avg_rr ?? a.avgRr ?? a.rr_avg ?? a.avg_rr_ms ?? null;
      const maxRr = a.max_rr ?? a.maxRr ?? a.rr_max ?? null;
      const avgVerticalRatio = a.avg_vertical_ratio ?? a.vertical_ratio ?? a.vertical_osc ?? a.avg_vertical_osc ?? a.avg_vertical_oscillation ?? a.avg_vertical_oscillation_cm ?? a.vertical_oscillation ?? a.avg_vertical_ratio_pct ?? null;
      return { distance_km: Number.isFinite(d) ? d : null, duration_min: dur, calories: Number.isFinite(cal) ? cal : null, avg_pace: Number.isFinite(pace) ? pace : null, avg_rr: Number.isFinite(Number(avgRr)) ? Number(avgRr) : null, max_rr: Number.isFinite(Number(maxRr)) ? Number(maxRr) : null, avg_vertical_ratio: Number.isFinite(Number(avgVerticalRatio)) ? Number(avgVerticalRatio) : null };
    });

    function pearson(xs, ys) { const x = []; const y = []; for (let i = 0; i < xs.length; i++) { const xv = xs[i]; const yv = ys[i]; if (xv == null || yv == null) continue; if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue; x.push(xv); y.push(yv); } const n = x.length; if (n < 2) return null; const mean = arr => arr.reduce((s,v)=>s+v,0)/arr.length; const mx = mean(x); const my = mean(y); let num = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx; const dy = y[i] - my; num += dx * dy; sx += dx*dx; sy += dy*dy; } const denom = Math.sqrt(sx * sy); if (denom === 0) return null; return num / denom; }

    const matrix = {};
    fields.forEach(a => { matrix[a] = {}; fields.forEach(b => { const va = rows.map(r => r[a]); const vb = rows.map(r => r[b]); const v = pearson(va, vb); matrix[a][b] = v == null ? null : Number(v); }); });

    const sig = [];
    for (let i = 0; i < fields.length; i++) { for (let j = i+1; j < fields.length; j++) { const a = fields[i]; const b = fields[j]; const v = matrix[a][b]; if (v != null && Math.abs(v) >= (corrThreshold || 0)) { sig.push({ field1: a, field2: b, correlation: v, method: 'pearson' }); } } }
    return { correlations: { pearson: matrix }, significant_correlations: sig, data_points: rows.length };
  }, [sportActivities, corrThreshold]);

  const periodTotals = React.useMemo(() => { try { return sportActivities.reduce((t, a) => { t.distance += Number(a.distance_km) || 0; t.durationMin += Number(a.duration_min) || 0; t.calories += Number(a.calories) || 0; return t; }, { distance: 0, durationMin: 0, calories: 0 }); } catch (e) { return { distance: 0, durationMin: 0, calories: 0 }; } }, [sportActivities]);

  const avgPerDay = React.useMemo(() => ({ distance: (periodTotals.distance || 0) / Math.max(1, Number(periodDays) || 1), durationMin: (periodTotals.durationMin || 0) / Math.max(1, Number(periodDays) || 1) }), [periodTotals, periodDays]);

  React.useEffect(() => { try { console.log('DEBUG Cycling data', { periodDays, sportActivitiesCount: sportActivities.length, sportActivitiesSample: sportActivities.slice(0,5), analysis, displayedWeeks }); } catch (e) { /* ignore */ } }, [periodDays, sportActivities, analysis, displayedWeeks]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Cycling Analytics</h1>
  <p className="page-subtitle">Specialized cycling metrics: distance, avg_pace (power-aware where available), trend forecasts and goal simulations.</p>
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
            <button aria-label="Refresh data" className="btn btn-secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</button>
            <div className="flex items-center gap-2 ml-4 text-xs">
              <select value={dateRangeMode} onChange={e=>setDateRangeMode(e.target.value)} className="select select-sm">
                <option value="rolling">Rolling</option>
                <option value="explicit">Range</option>
              </select>
            </div>
          </div>
          <div className="ml-auto flex gap-2 order-3 md:order-2">
            {/* Gym link removed - navigate via Activity quick-links */}
          </div>
        </div>
      </div>
      <div className="page-content space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-2 flex flex-col gap-4">
            <MetricCard title={`Distance (${periodDays}d)`} value={(periodTotals.distance || 0).toFixed(2)} unit="km" icon="🚴" color="indigo" subtitle={`Avg ${avgPerDay.distance.toFixed(2)} km/day · ${displayedWeeks.length} w`} tooltip={`Sum of cycling distance over the selected ${periodDays}‑day window`} />
            <MetricCard title="Rolling Pace (4w)" value={(() => { const raw = weeklyGroups[weeklyGroups.length-1]?.rollingAvgPace4; const formatted = raw != null ? formatPaceMinPerKm(raw) : '-'; return raw != null ? `${formatted}` : '-'; })()} unit="Avg Pace" icon="🚴" color="green" subtitle={`Active days: ${aggregates.activeDays} · Streak ${weeklyGroups[weeklyGroups.length-1]?.streakUp ?? 0}`} tooltip={`Latest 4-week rolling pace (lower is better).`} />
            <MetricCard title={`Active Minutes (${periodDays}d)`} value={((periodTotals.durationMin || 0) / 60).toFixed(1)} unit="h" icon="⏱️" color="yellow" subtitle={`Avg ${((avgPerDay.durationMin || 0) / 60).toFixed(1)} h/day`} tooltip={`Sum of activity durations over the selected ${periodDays}‑day window (converted to hours)`} />
            <MetricCard title={dateRangeMode==='explicit' ? 'Rides (range)' : `Rides (${periodDays}d)`} value={String(sportActivities.length)} unit="rides" icon="🏁" color="blue" subtitle={`Avg ${ (sportActivities.length / Math.max(1, periodDays)).toFixed(2) } rides/day`} tooltip={`Average rides per day over the selected ${dateRangeMode==='explicit'?'explicit date range':periodDays+'‑day window'} (client-side)`} />
          </div>

          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Last {displayedWeeks.length} Weeks Distance</h3><span className="text-[10px] text-gray-500">km</span></div>
            <div className="card-content">{distanceSeries.length > 0 ? (<WeeklyDistanceChart series={distanceSeries} height={200} rollingWindow={4} />) : <div className="text-xs text-gray-500">No distance data for selected period</div>}</div>
          </div>

          <div className="card md:col-span-5">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Avg Pace (4w)</h3><span className="text-[10px] text-gray-500">Avg Pace</span></div>
            <div className="card-content">{paceSeries.filter(p => p.value != null).length > 1 ? (<WeeklyPaceChart series={paceSeries.map(p => ({ label: p.label, weekly: p.value, rolling: p.value }))} height={200} />) : <div className="text-xs text-gray-500">Insufficient pace data (need at least 2 weeks)</div>}</div>
          </div>
        </div>

        {busy && sportActivities.length === 0 && <LoadingSpinner message="Loading cycling activities..." />}
        {error && sportActivities.length === 0 && <ErrorMessage message={error} />}

        <div className="card">
          <div className="card-header flex flex-wrap gap-3 items-center justify-between"><h3 className="card-title">Distance vs Rolling Pace Trend</h3><div className="text-[11px] text-gray-500">Lower pace = better · Rolling pace = 4w avg</div></div>
          <div className="card-content"><TrendComparison height={220} data={displayedWeeks.map(w => ({ label: w.week, distance: (w.distance != null ? w.distance : (w.total_distance_km ?? 0)), rollingPace: (w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace ?? null)) }))} forecast={{ distance: predictions.predictedDistance, rollingPace: predictions.predictedRollingPace }} /></div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3"><h3 className="card-title">Forecast Controls</h3><div className="text-[11px] text-gray-500">Blend = regression vs EWMA weight · α = smoothing factor</div></div>
          <div className="card-content grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4 flex gap-6 flex-wrap text-xs mb-2"><div><label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">Window</label><select value={predWindow} onChange={e=>setPredWindow(Number(e.target.value))} className="select select-sm">{[4,5,6,7,8,9,10,12].map(w => <option key={w} value={w}>{w}</option>)}</select></div>
            <div><label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">Blend</label><input aria-label="Blend ratio" type="range" min={0} max={1} step={0.05} value={predBlend} onChange={e=>setPredBlend(Number(e.target.value))} /><div className="text-[10px] text-gray-500">{(predBlend*100).toFixed(0)}% regression</div></div>
            <div><label className="block mb-1 font-medium text-[11px] uppercase tracking-wide">EWMA α</label><input aria-label="EWMA alpha" type="range" min={0.1} max={0.9} step={0.05} value={predAlpha} onChange={e=>setPredAlpha(Number(e.target.value))} /><div className="text-[10px] text-gray-500">α={predAlpha.toFixed(2)}</div></div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Distance Forecast</div><div className="text-lg font-semibold">{predictions.predictedDistance != null ? predictions.predictedDistance.toFixed(2)+' km' : '—'}</div><div className="text-xs text-gray-500">Conf: {predictions.distanceConfidence}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Steps Forecast</div><div className="text-lg font-semibold">{predictions.predictedSteps != null ? predictions.predictedSteps.toFixed(0) : '—'}</div><div className="text-xs text-gray-500">Conf: {predictions.stepsConfidence}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Rolling Pace Forecast</div><div className="text-lg font-semibold">{predictions.predictedRollingPace != null ? (formatPaceMinPerKm(predictions.predictedRollingPace) || predictions.predictedRollingPace.toFixed(2)) + ' min/km' : '—'}</div><div className="text-xs text-gray-500">{predictions.paceImprovement != null ? (predictions.paceImprovement>0?'+':'')+predictions.paceImprovement.toFixed(1)+'% vs last' : ''}</div><div className="text-xs text-gray-500">Conf: {predictions.paceConfidence}</div></div>
            <div className="text-[10px] text-gray-500 md:col-span-1">Regression blend (linear trend) + EWMA (smoothing). Lower pace = better.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3"><h3 className="card-title">Goal Simulation</h3><div className="flex gap-4 flex-wrap text-xs"><div><label className="block text-gray-500 mb-1">Distance Goal (km)</label><input type="number" min={0} step={0.5} value={simDistanceGoal} onChange={e=>setSimDistanceGoal(e.target.value)} className="input input-sm w-28" placeholder="e.g. 200" /></div><div><label className="block text-gray-500 mb-1">Rolling Pace Goal</label><input type="number" min={0} step={0.1} value={simPaceGoal} onChange={e=>setSimPaceGoal(e.target.value)} className="input input-sm w-28" placeholder="e.g. 2.30" /></div></div></div>
          <div className="card-content grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><h4 className="font-semibold mb-2">Distance Projection</h4>{simDistanceGoal ? (simulation.distance ? (<div className="space-y-1 text-sm"><div>Goal: <strong>{simDistanceGoal} km</strong></div><div>Status: {simulation.distance.message}</div>{simulation.distance.weeks != null && <div>Weeks: <strong>{simulation.distance.weeks}</strong></div>}{simulation.distance.etaDate && <div>ETA: {simulation.distance.etaDate.toISOString().slice(0,10)}</div>}<div className="text-xs text-gray-500">Slope: {predictions.regression.distReg?.slope?.toFixed(2) || '-'} km/wk</div></div>) : <div className="text-sm text-gray-500">No data.</div>) : <div className="text-sm text-gray-500">Enter distance goal.</div>}</div>
            <div><h4 className="font-semibold mb-2">Pace Projection</h4>{simPaceGoal ? (simulation.pace ? (<div className="space-y-1 text-sm"><div>Goal: <strong>{simPaceGoal} min/km</strong></div><div>Status: {simulation.pace.message}</div>{simulation.pace.weeks != null && <div>Weeks: <strong>{simulation.pace.weeks}</strong></div>}{simulation.pace.etaDate && <div>ETA: {simulation.pace.etaDate.toISOString().slice(0,10)}</div>}<div className="text-xs text-gray-500">Slope: {predictions.regression.paceReg?.slope?.toFixed?.(3) || '-'} min/km/wk</div></div>) : <div className="text-sm text-gray-500">No data.</div>) : <div className="text-sm text-gray-500">Enter pace goal.</div>}</div>
            <div className="md:col-span-2 text-[10px] text-gray-500 flex flex-wrap gap-4"><span>Linear projection – does not account for adaptation, injury or taper.</span><span className="text-indigo-600">Slope dist: {predictions.regression?.distReg?.slope?.toFixed?.(2) || '-' } km/wk</span><span className="text-green-600">Slope pace: {predictions.regression?.paceReg?.slope?.toFixed?.(3) || '-' } min/km/wk</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3"><h3 className="card-title">Cycling Correlations</h3><span className="text-[11px] text-gray-500">Pairwise Pearson correlations for cycling activities (source: full)</span></div>
          <div className="card-content grid grid-cols-1 md:grid-cols-3 gap-5"><div className="md:col-span-2 space-y-2"><div className="flex flex-wrap gap-4 items-center text-[11px]"><div className="flex items-center gap-2"><label className="text-gray-500 uppercase tracking-wide text-[10px]">Min |r|</label><input type="range" min={0} max={1} step={0.05} value={corrThreshold} onChange={e=>setCorrThreshold(Number(e.target.value))} /><span className="text-xs tabular-nums">{corrThreshold.toFixed(2)}</span></div></div><div className="rounded-lg ring-1 ring-slate-800/60 p-2 bg-gradient-to-b from-slate-950 to-slate-900">{(() => { let raw = corrSource === 'full' ? (analysis?.correlations_full || null) : corrSource === 'extended' ? (analysis?.correlations_extended || null) : sportCorrelations.correlations.pearson; if (corrSource === 'full' && !raw) { return <div className="text-[11px] text-gray-500 px-2 py-3">No server full correlation matrix returned.</div>; } if (raw) { try { const metrics = Object.keys(raw || {}); const keep = metrics.filter(m => Object.values(raw[m] || {}).some(v => typeof v === 'number')); if (keep.length && keep.length < metrics.length) { const pruned = {}; keep.forEach(a => { pruned[a] = {}; keep.forEach(b => { pruned[a][b] = raw[a]?.[b] ?? null; }); }); raw = pruned; } if (!keep.length) raw = null; } catch (e) { /* ignore pruning issues */ } } if (!raw) { return <div className="text-[11px] text-gray-500 px-2 py-3">Full matrix has no overlapping numeric pairs to compute correlations.</div>; } return (<CorrelationHeatmap matrix={raw} method="pearson" title={corrSource === 'full' ? 'Full Correlations' : corrSource === 'extended' ? 'Extended Correlations' : 'Pearson matrix'} compact={true} shrinkToContent={true} cellSize={corrSource === 'full' ? 34 : 48} showLegend={false} colorScheme={corrColorScheme} />); })()}</div></div><div className="space-y-4"><h4 className="font-semibold mb-1">Full correlation list</h4><div className="text-[11px] text-gray-400 mb-2">All pairs with |r| ≥ {corrThreshold.toFixed(2)}</div><div className="space-y-3">{/* list built similarly to walking/running pages */}{/* ...existing code... */}</div></div></div>
        </div>

      </div>
    </div>
  );
};

export default Cycling;
