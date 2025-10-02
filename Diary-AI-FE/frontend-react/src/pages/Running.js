import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useActivityAggregates from '../hooks/useActivityAggregates';
import useActivityPredictions from '../hooks/useActivityPredictions';
import useGoalSimulation from '../hooks/useGoalSimulation';
import TrendComparison from '../components/TrendComparison';
import SegmentedControl from '../components/SegmentedControl';
import Sparkline from '../components/Sparkline';
import { activitiesAPI } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

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

  React.useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        const res = await activitiesAPI.getLatestActivities(limit);
        setAllActivities(res.activities || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load activities');
      } finally {
        setBusy(false);
      }
    };
    load();
  }, [limit]);

  // Persist period selection
  React.useEffect(() => {
    try { localStorage.setItem('runningPeriodDays', String(periodDays)); } catch (e) { /* ignore */ }
  }, [periodDays]);

  React.useEffect(() => {
    try { localStorage.setItem('runningShowAggregated', showAggregated ? '1' : '0'); } catch (e) { }
  }, [showAggregated]);

  // Adjust fetch limit heuristically when period changes and trigger reload via limit change
  React.useEffect(() => {
    const map = { 7: 100, 14: 200, 30: 400, 60: 800, 90: 1000, 180: 1500, 365: 2500 };
    const newLimit = map[periodDays] || 400;
    if (newLimit !== limit) setLimit(newLimit);
    // load will be triggered by limit change effect
  }, [periodDays]);
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

  const displayedWeeks = aggregateWeeks(displayedWeeksRaw, maxPointsForDisplay);
  const distanceSeries = displayedWeeks.map((w, i) => ({ value: w.distance, label: w.week || `W${i+1}` }));
  const paceSeries = displayedWeeks.map((w, i) => ({ value: w.rollingAvgPace4, label: w.week || `W${i+1}` }));

  // compute displayed date range for UI
  const startDate = new Date(lastRunning - (periodDays * 24 * 60 * 60 * 1000));
  const endDate = new Date(lastRunning);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Running Analytics</h1>
  <p className="page-subtitle">Specialized running metrics: distance, pace (min/km), trend forecasts and goal simulations.</p>
        <div className="toolbar flex gap-2 mt-4 flex-wrap items-center">
          <div className="flex gap-2 order-1 items-center">
            <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))} className="period-select">
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 2 weeks</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 2 months</option>
              <option value={90}>Last 3 months</option>
              <option value={180}>Last 6 months</option>
              <option value={365}>Last 1 year</option>
            </select>
            <button aria-label="Refresh data" className="btn btn-secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</button>
            <label className="ml-3 flex items-center text-sm">
              <input type="checkbox" checked={showAggregated} onChange={e=>setShowAggregated(e.target.checked)} className="mr-2" />
              Aggregated
            </label>
            <div className="ml-4 text-sm text-gray-600">Showing: {startDate.toISOString().slice(0,10)} → {endDate.toISOString().slice(0,10)}</div>
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
                  tooltipFormatter={(pt,i)=>`${paceSeries[i].label || 'Week'}: ${pt.value != null ? pt.value.toFixed(2)+' min/km' : '—'}`}
                />
              ) : (
                <div className="text-xs text-gray-500">Insufficient pace data (need at least 2 weeks)</div>
              )}
            </div>
          </div>
          <div className="card md:col-span-2">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Current Week Snapshot</h3>
              <div className="text-[10px] text-gray-500">Streak ↑ distance</div>
            </div>
            <div className="card-content grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] md:text-sm">
              <div className="font-medium text-gray-500">Today</div><div>{aggregates.todayDistance?.toFixed?.(2) || 0} km</div>
              <div className="font-medium text-gray-500">Week Dist</div><div>{aggregates.weeklyDistance?.toFixed?.(2) || 0} km</div>
              <div className="font-medium text-gray-500">Active Days</div><div>{aggregates.activeDays} / 7</div>
              <div className="font-medium text-gray-500">Roll Pace 4w</div><div>{weeklyGroups[weeklyGroups.length-1]?.rollingAvgPace4?.toFixed?.(2) || '-'}</div>
              <div className="font-medium text-gray-500">Streak Up</div><div>{weeklyGroups[weeklyGroups.length-1]?.streakUp ?? 0}</div>
            </div>
          </div>
        </div>

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
              <div className="text-lg font-semibold">{predictions.predictedRollingPace != null ? predictions.predictedRollingPace.toFixed(2)+' min/km' : '—'}</div>
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
      </div>
    </div>
  );
};

export default Running;
