import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { activitiesAPI } from '../services';
import Sparkline from '../components/Sparkline';
import useActivityAggregates from '../hooks/useActivityAggregates';
import MetricCard from '../components/MetricCard';
import SegmentedControl from '../components/SegmentedControl';
// Advanced running-specific analytics (trend comparison, predictions, simulations)
// have been moved to the dedicated Running page.

const Activity = () => {
  const { error, dashboardData, fetchDashboardForDays } = useHealthData();
  const [activities, setActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(400); // dynamic based on selected period
  const [periodDays, setPeriodDays] = useState(() => {
    const raw = localStorage.getItem('activityPeriodDays');
    const parsed = Number(raw);
    return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30;
  }); // 7 | 14 | 30 | 90
  const [filterSport, setFilterSport] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('start_time');
  const [sortDir, setSortDir] = useState('desc');
  const [dailyStepsGoal, setDailyStepsGoal] = useState(() => Number(localStorage.getItem('dailyStepsGoal')) || 10000);
  const [weeklyDistanceGoal, setWeeklyDistanceGoal] = useState(() => Number(localStorage.getItem('weeklyDistanceGoal')) || 50);
  const [editingGoal, setEditingGoal] = useState(null); // 'steps' | 'distance' | null

  const loadActivities = useCallback(async (opts = {}) => {
    try {
      setBusy(true);
      const res = await activitiesAPI.getLatestActivities(opts.limit || limit);
      setActivities(res.activities || []);
    } catch (e) {
      console.error('Failed to load activities', e);
    } finally {
      setBusy(false);
    }
  }, [limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Adjust fetch limit when period changes (heuristic mapping)
  useEffect(() => {
    const map = { 7: 100, 14: 200, 30: 400, 90: 1000 };
    const newLimit = map[periodDays] || 400;
    if (newLimit !== limit) setLimit(newLimit);
    // Reload activities for the selected period and also refresh
    // the shared dashboard/health data so the whole page updates
    // to the chosen window (steps, sleep, correlations, etc.).
    loadActivities({ limit: newLimit });
    // Refresh dashboard windowed health data (race-guarded in context)
    try {
      fetchDashboardForDays(periodDays);
    } catch (e) {
      // defensive: ensure UI doesn't crash if context method fails
      console.warn('Failed to refresh dashboard for new period', e);
    }
  }, [periodDays, loadActivities, fetchDashboardForDays, limit]);

  // Persist the user's chosen activity period (e.g. Last 2 weeks) so
  // the preference survives reloads.
  useEffect(() => {
    try {
      localStorage.setItem('activityPeriodDays', String(periodDays));
    } catch (e) {
      console.warn('Failed to persist activityPeriodDays to localStorage', e);
    }
  }, [periodDays]);

  // Persist goals when changed
  useEffect(() => {
    localStorage.setItem('dailyStepsGoal', String(dailyStepsGoal));
  }, [dailyStepsGoal]);
  useEffect(() => {
    localStorage.setItem('weeklyDistanceGoal', String(weeklyDistanceGoal));
  }, [weeklyDistanceGoal]);

  // Activities restricted to selected period
  const periodActivities = useMemo(() => {
    const now = Date.now();
    const cutoff = now - periodDays * 24 * 60 * 60 * 1000;
    return activities.filter(a => {
      if (!a.start_time) return false;
      const t = new Date(a.start_time).getTime();
      return !Number.isNaN(t) && t >= cutoff && t <= now;
    });
  }, [activities, periodDays]);

  const uniqueSports = useMemo(() => {
    const set = new Set();
    periodActivities.forEach(a => { if (a.sport) set.add(a.sport); });
    return Array.from(set).sort();
  }, [periodActivities]);

  const {
    todaySteps,
    todayActivities,
    todayDistance,
    todayCalories,
    weeklySteps,
    weeklyDistance,
  // activeDays intentionally unused in this view
    last14DaysSeries,
    weeklyGroups
  } = useActivityAggregates(periodActivities);

  // If weeklyGroups lack steps (aggregated from activities), try to fill steps
  // from the health dashboard window data (dashboardData.windowData) as a fallback.
  const weeklyGroupsFilled = useMemo(() => {
    try {
      const rows = (dashboardData?.windowData) || (dashboardData?.healthData?.all) || [];
      if (!Array.isArray(weeklyGroups) || weeklyGroups.length === 0) return weeklyGroups;

      const pickRowSteps = (r) => {
        if (!r || typeof r !== 'object') return null;
        const candidates = ['steps','total_steps','step_count','daily_steps','totalSteps','stepCount','steps_total'];
        for (const k of candidates) {
          if (k in r) {
            const v = r[k];
            const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(String(v).replace(/[\s,]+/g,'')) : Number(v));
            if (!Number.isNaN(n)) return n;
          }
        }
        return null;
      };

      const weekMap = new Map();
      // build map weekKey -> sum steps from rows
      rows.forEach(r => {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;
        // compute ISO week key same format as in hook: YYYY-Www
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7; // 0=Mon
        tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
        const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
        const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
        const year = tmp.getUTCFullYear();
        const key = `${year}-W${String(week).padStart(2,'0')}`;
        const s = pickRowSteps(r);
        if (s != null) weekMap.set(key, (weekMap.get(key) || 0) + s);
      });

      return weeklyGroups.map(w => ({
        ...w,
        steps: (w.steps != null && w.steps !== undefined) ? w.steps : (weekMap.get(w.week) != null ? weekMap.get(w.week) : null)
      }));
    } catch (e) {
      return weeklyGroups;
    }
  }, [weeklyGroups, dashboardData]);

  // derive today's total duration in minutes from today's activities
  const todayDuration = useMemo(() => {
    try {
      const arr = (todayActivities || []);
      return arr.reduce((s, a) => s + (Number(a.duration_min) || 0), 0);
    } catch (e) { return 0; }
  }, [todayActivities]);

  // Fallback: if activity objects lack step data, derive from health dashboard daily entries
  const { fallbackTodaySteps, fallbackWeeklySteps } = React.useMemo(() => {
    if (todaySteps > 0 && weeklySteps > 0) return { fallbackTodaySteps: 0, fallbackWeeklySteps: 0 };
    const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
    if (!Array.isArray(rows) || rows.length === 0) return { fallbackTodaySteps: 0, fallbackWeeklySteps: 0 };
    const todayKey = new Date().toISOString().slice(0,10);
    let todayVal = 0;
    const last7Keys = new Set();
    for (let i=0;i<7;i++) {
      const d = new Date();
      d.setDate(d.getDate()-i);
      last7Keys.add(d.toISOString().slice(0,10));
    }
    let weeklySum = 0;
    rows.forEach(r => {
      const rawDate = r.day || r.date || r.timestamp || r.day_date;
      if (!rawDate) return;
      const key = (typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString()).slice(0,10);
      const stepsVal = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
      if (key === todayKey) todayVal = Math.max(todayVal, stepsVal); // if multiple entries, take max
      if (last7Keys.has(key)) weeklySum += stepsVal;
    });
    return { fallbackTodaySteps: todaySteps > 0 ? 0 : todayVal, fallbackWeeklySteps: weeklySteps > 0 ? 0 : weeklySum };
  }, [todaySteps, weeklySteps, dashboardData]);

  const displayTodaySteps = todaySteps > 0 ? todaySteps : fallbackTodaySteps;
  const displayWeeklySteps = weeklySteps > 0 ? weeklySteps : fallbackWeeklySteps;
  const [sparkMetric, setSparkMetric] = useState('distance'); // 'distance' | 'steps' | 'calories'
  const [weeksRange /*, setWeeksRange */] = useState(8); // can be 4 / 8 / 12
  const [weeklySortKey, setWeeklySortKey] = useState('week');
  const [weeklySortDir, setWeeklySortDir] = useState('asc');

  const goalProgressSteps = dailyStepsGoal ? Math.min(100, (displayTodaySteps / dailyStepsGoal) * 100) : 0;
  const goalProgressDistance = weeklyDistanceGoal ? Math.min(100, (weeklyDistance / weeklyDistanceGoal) * 100) : 0;
  // Prediction / simulation state removed (now only on Running page)
  // Precompute previous week lookup for trend arrows
  const trimmedWeekly = useMemo(() => (weeklyGroupsFilled || weeklyGroups).slice(-weeksRange), [weeklyGroups, weeklyGroupsFilled, weeksRange]);

  const sortedWeekly = useMemo(() => {
    const arr = [...trimmedWeekly];
    arr.sort((a,b) => {
      let va = a[weeklySortKey];
      let vb = b[weeklySortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return weeklySortDir === 'asc' ? va - vb : vb - va;
      return weeklySortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [trimmedWeekly, weeklySortKey, weeklySortDir]);

  const toggleWeeklySort = (key) => {
    if (weeklySortKey === key) {
      setWeeklySortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setWeeklySortKey(key);
      setWeeklySortDir(key === 'week' ? 'asc' : 'desc');
    }
  };
  const trendFor = (array, index) => {
    if (index === 0) return { symbol: '·', pct: null, diff: 0 };
    const prev = array[index-1];
    const current = array[index];
    if (!prev) return { symbol: '·', pct: null, diff: 0 };
    const diff = current.distance - prev.distance;
    const pct = prev.distance ? (diff / prev.distance) * 100 : null;
    let symbol = '→';
    if (pct != null && Math.abs(pct) >= 1) symbol = diff > 0 ? '↑' : '↓';
    return { symbol, pct, diff };
  };
  // Row coloring threshold: relative to distance goal (weeklyDistanceGoal)
  const rowClassFor = (distance) => {
    if (!weeklyDistanceGoal) return '';
    const pct = distance / weeklyDistanceGoal;
    if (pct >= 1.1) return 'bg-green-50 dark:bg-green-900/20';
    if (pct >= 0.9) return 'bg-yellow-50 dark:bg-yellow-900/20';
    if (pct >= 0.6) return 'bg-orange-50 dark:bg-orange-900/20';
    return 'bg-red-50 dark:bg-red-900/20';
  };

  const filtered = useMemo(() => {
    return periodActivities.filter(a => {
      if (filterSport && a.sport !== filterSport) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!((a.name || '').toLowerCase().includes(s) || (a.sport || '').toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [periodActivities, filterSport, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleGoalEdit = (type) => setEditingGoal(type);
  const handleGoalSave = (type, value) => {
    const num = Number(value);
    if (!Number.isNaN(num) && num > 0) {
      if (type === 'steps') setDailyStepsGoal(num);
      if (type === 'distance') setWeeklyDistanceGoal(num);
    }
    setEditingGoal(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">Track your general daily & weekly activity. Detailed running and gym analytics moved to dedicated views.</p>
        </div>
        <div className="header-controls">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="period-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 2 months</option>
            <option value={90}>Last 3 months</option>
          </select>
          <button aria-label="Refresh activities" className="btn btn-primary" disabled={busy} onClick={() => loadActivities({ limit })}>{busy ? 'Loading...' : 'Refresh'}</button>
          <div className="header-links">
            <Link to="/running" className="btn btn-outline" title="Go to Running analytics">Running →</Link>
            <Link to="/gym" className="btn btn-outline" title="Go to Gym analytics">Gym →</Link>
          </div>
        </div>
      </div>
      
      <div className="page-content">
        {(busy && activities.length === 0) ? (
          <LoadingSpinner message="Loading latest activities..." />
        ) : null}
        {(error && activities.length === 0) ? (
          <ErrorMessage message={error} />
        ) : null}

        <div className="space-y-8">
          {/* Overview Metrics (Sleep-style) */}
          <div className="overview-metrics">
            <MetricCard
              title="Active Minutes Today"
              value={todayDuration.toFixed(0)}
              unit="min"
              icon="⏱️"
              color="green"
              subtitle={`${displayTodaySteps.toLocaleString()} steps · ${todayCalories || 0} kcal`}
              trend={0}
              tooltip="Sum of activity durations recorded today"
            />
            <MetricCard
              title="Distance Today"
              value={todayDistance.toFixed(2)}
              unit="km"
              icon="📏"
              color="indigo"
              subtitle="Recorded distance"
              trend={0}
            />
            <MetricCard
              title="Weekly Distance"
              value={weeklyDistance.toFixed(1)}
              unit="km"
              icon="📆"
              color="purple"
              subtitle={`Goal ${weeklyDistanceGoal} km`}
              trend={goalProgressDistance - 100}
            />
            <MetricCard
              title="Avg Steps / Day"
              value={displayWeeklySteps > 0 ? (displayWeeklySteps/7).toFixed(0) : (displayTodaySteps ? Math.max(0, Math.round(displayTodaySteps)) : 0)}
              unit=""
              icon="📊"
              color="blue"
              subtitle="Last 7 days avg"
              trend={0}
            />
          </div>

          {/* Goals Card (Enhanced) */}
          <div className="card">
            <div className="card-header flex items-center justify-between flex-wrap gap-3">
              <h3 className="card-title">Activity Goals</h3>
              <div className="hidden md:flex items-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Steps</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Distance</span>
              </div>
            </div>
            <div className="card-content space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded border bg-white/60 dark:bg-gray-900/40 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Daily Steps</span>
                    {editingGoal === 'steps' ? (
                      <input aria-label="Daily steps goal" autoFocus type="number" min={1} defaultValue={dailyStepsGoal} onBlur={e => handleGoalSave('steps', e.target.value)} onKeyDown={e => { if (e.key==='Enter') handleGoalSave('steps', e.target.value); if (e.key==='Escape') setEditingGoal(null); }} className="w-24 input input-xs" />
                    ) : (
                      <button onClick={()=>handleGoalEdit('steps')} className="font-semibold hover:underline" title="Edit goal">{dailyStepsGoal.toLocaleString()}</button>
                    )}
                  </div>
                  <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${goalProgressSteps}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Progress</span><span>{goalProgressSteps.toFixed(0)}%</span></div>
                </div>
                <div className="p-3 rounded border bg-white/60 dark:bg-gray-900/40 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Weekly Distance</span>
                    {editingGoal === 'distance' ? (
                      <input aria-label="Weekly distance goal" autoFocus type="number" min={1} step={0.5} defaultValue={weeklyDistanceGoal} onBlur={e => handleGoalSave('distance', e.target.value)} onKeyDown={e => { if (e.key==='Enter') handleGoalSave('distance', e.target.value); if (e.key==='Escape') setEditingGoal(null); }} className="w-24 input input-xs" />
                    ) : (
                      <button onClick={()=>handleGoalEdit('distance')} className="font-semibold hover:underline" title="Edit goal">{weeklyDistanceGoal} km</button>
                    )}
                  </div>
                  <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${goalProgressDistance}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Progress</span><span>{goalProgressDistance.toFixed(0)}%</span></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">14-Day Trend</span>
                  <div>
                    <SegmentedControl
                      options={[{value:'distance', label:'Distance'},{value:'steps', label:'Steps'},{value:'calories', label:'Calories'}]}
                      value={sparkMetric}
                      onChange={setSparkMetric}
                      size="sm"
                      ariaLabel="Sparkline metric"
                    />
                  </div>
                </div>
                <div className="relative">
                  <Sparkline
                    data={last14DaysSeries.map(p => ({ value: p[sparkMetric] }))}
                    height={46}
                    stroke={sparkMetric==='distance' ? '#10b981' : sparkMetric==='steps' ? '#6366f1' : '#f59e0b'}
                    fill={sparkMetric==='calories' ? 'rgba(245,158,11,0.18)' : sparkMetric==='steps' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}
                    tooltipFormatter={(pt,i)=>`${last14DaysSeries[i].date}: ${sparkMetric==='distance'? pt.value.toFixed(2)+' km' : sparkMetric==='steps'? pt.value.toLocaleString()+' steps' : pt.value.toLocaleString()+' kcal'}`}
                  />
                </div>
              </div>
            </div>
          </div>
  </div>

        {/* Advanced charts & simulations removed. See Running Analytics page for forecasts and goal simulations. */}

        {/* Weekly Trends */}
        <div className="card mt-6">
          <div className="card-header flex flex-wrap gap-4 justify-between items-start">
            <div className="space-y-1">
              <h3 className="card-title">Weekly Trends</h3>
              <div className="text-[11px] text-gray-500">Distance, steps, calories & pacing per ISO week</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-[10px] text-gray-500">Click headers to sort</div>
            </div>
          </div>
          <div className="card-content overflow-x-auto text-gray-800 dark:text-gray-100">
            {sortedWeekly.length === 0 ? <div className="text-sm text-gray-500">No weekly data yet</div> : (
              <table className="min-w-full text-xs md:text-[13px] border-separate border-spacing-0 text-gray-800 dark:text-gray-100">
                <thead>
                  <tr className="text-left bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
                    {[
                      ['week','Week'],
                      ['trend','Trend'],
                      ['streakUp','Streak↑'],
                      ['distanceChange','Change %'],
                      ['distance','Distance (km)'],
                      ['steps','Steps'],
                      ['calories','Calories'],
                      ['durationMin','Duration (min)'],
                      ['avgPace','Avg Pace'],
                      ['rollingAvgPace4','Rolling Pace (4w)'],
                      ['paceImprovementPct','Pace Δ%'],
                      ['avgHr','Avg HR'],
                      ['trainingLoad','Training Load'],
                      ['effects','Effects (Aer/Ana)'],
                      ['activeDaysCount','Consistency'],
                      ['progress','Progress'],
                      ['mini','Mini Dist']
                    ].map(([key,label]) => {
                      const sortable = !['trend','effects','mini','progress'].includes(key);
                      const active = weeklySortKey === key || (key==='distanceChange' && weeklySortKey==='distance');
                      const dir = active ? (weeklySortDir==='asc'?'▲':'▼') : '';
                      const clickKey = key==='distanceChange' ? 'distance' : key;
                      return (
                        <th key={key} onClick={sortable?()=>toggleWeeklySort(clickKey):undefined} className={`py-2 px-3 font-medium text-[11px] uppercase tracking-wide align-bottom ${sortable?'cursor-pointer select-none':''} ${key==='week'? 'sticky left-0 z-10 sticky bg-white dark:bg-gray-900 shadow-after' : ''} text-gray-700 dark:text-gray-100`}>{label} {dir && <span className="text-[9px] ml-0.5">{dir}</span>}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedWeekly.map((w, i, arr) => {
                    const t = trendFor(arr, i);
                    const color = t.symbol === '↑' ? 'text-green-600' : t.symbol === '↓' ? 'text-red-600' : 'text-gray-500';
                    const diffKm = t.diff;
                    const goalPct = weeklyDistanceGoal ? (w.distance / weeklyDistanceGoal) * 100 : null;
                    return (
                      <tr key={w.week} className={`group border-b last:border-b-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors bg-white dark:bg-gray-900 ${rowClassFor(w.distance)}`} title={`Diff vs prev: ${diffKm>0?'+':''}${diffKm.toFixed(2)} km | Goal: ${goalPct!=null?goalPct.toFixed(0)+'%':'n/a'}`}> 
                        <td className="py-2 px-3 font-semibold sticky left-0 sticky bg-white dark:bg-gray-900 z-10 text-gray-900 dark:text-gray-100">{w.week}</td>
                        <td className={`py-2 px-3 font-semibold ${color}`}>{t.symbol}</td>
                        <td className="py-2 px-3">{w.streakUp}</td>
                        <td className={`py-2 px-3 ${t.pct == null ? 'text-gray-400' : color}`}>{t.pct == null ? '—' : `${t.pct > 0 ? '+' : ''}${t.pct.toFixed(1)}%`}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{w.distance.toFixed(2)}</td>
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{typeof w.steps === 'number' ? w.steps.toLocaleString() : '-'}</td>
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{typeof w.calories === 'number' ? w.calories.toLocaleString() : '-'}</td>
                        <td className="py-2 px-3">{typeof w.durationMin === 'number' ? w.durationMin.toFixed(0) : '-'}</td>
                        <td className="py-2 px-3">{w.avgPace != null ? w.avgPace.toFixed(2) : '-'}</td>
                        <td className="py-2 px-3">{w.rollingAvgPace4 != null ? w.rollingAvgPace4.toFixed(2) : '-'}</td>
                        <td className={`py-2 px-3 ${w.paceImprovementPct != null ? (w.paceImprovementPct > 0 ? 'text-green-600' : w.paceImprovementPct < 0 ? 'text-red-600' : 'text-gray-500') : 'text-gray-400'}`}>{w.paceImprovementPct != null ? `${w.paceImprovementPct>0?'+':''}${w.paceImprovementPct.toFixed(1)}%` : '—'}</td>
                        <td className="py-2 px-3">{w.avgHr != null ? w.avgHr.toFixed(0) : '-'}</td>
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{typeof w.trainingLoad === 'number' ? w.trainingLoad.toFixed(0) : '-'}</td>
                        <td className="py-2 px-3">{w.trainingEffect != null ? w.trainingEffect.toFixed(1) : '-'} / {w.anaerobicEffect != null ? w.anaerobicEffect.toFixed(1) : '-'}</td>
                        <td className="py-2 px-3">
                          <span className={
                            w.activeDaysCount >=7 ? 'text-green-600 font-semibold' :
                            w.activeDaysCount >=5 ? 'text-indigo-600' :
                            w.activeDaysCount >=3 ? 'text-yellow-600' : 'text-red-600'
                          }>{w.activeDaysCount} / 7</span>
                        </td>
                        <td className="py-2 px-3 w-32">
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                            <div className={`h-2 transition-all ${goalPct>=100?'bg-green-500':goalPct>=75?'bg-indigo-500':goalPct>=50?'bg-yellow-500':'bg-red-500'}`} style={{ width: `${Math.min(100, goalPct||0)}%` }} />
                          </div>
                          <div className="text-[10px] mt-1 text-gray-600 dark:text-gray-400">{goalPct!=null?goalPct.toFixed(0)+'%':''}</div>
                        </td>
                        <td className="py-2 px-3">
                          <Sparkline
                            data={w.dailyDistanceSeries.map(v => ({ value: v }))}
                            height={26}
                            stroke="#0ea5e9"
                            fill="rgba(14,165,233,0.15)"
                            tooltipFormatter={(pt, di) => `Day ${di+1}: ${pt.value.toFixed(2)} km`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-gray-500 items-center">
              <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800" /> ≥110% goal</div>
              <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800" /> 90–109% goal</div>
              <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" /> 60–89% goal</div>
              <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800" /> &lt;60% goal</div>
              <div className="flex-1 min-w-[240px]">Trend arrow compares weekly distance vs previous week. Pace Δ% = improvement vs previous rolling pace (lower is better).</div>
            </div>
            {/* Debug panel: enable by setting localStorage.debugShowActivities = '1' in DevTools */}
            {typeof window !== 'undefined' && localStorage.getItem('debugShowActivities') === '1' ? (
              <div className="mt-4 p-3 bg-black/5 dark:bg-white/5 rounded text-xs">
                <div className="font-semibold mb-2">Debug: weeklyGroups (first 3)</div>
                <pre style={{maxHeight: 240, overflow: 'auto'}}>{JSON.stringify(weeklyGroups.slice(0,3), null, 2)}</pre>
                <div className="font-semibold mt-2 mb-1">Debug: periodActivities (first 5)</div>
                <pre style={{maxHeight: 240, overflow: 'auto'}}>{JSON.stringify(periodActivities.slice(0,5), null, 2)}</pre>
              </div>
            ) : null}
            {typeof window !== 'undefined' && localStorage.getItem('debugShowActivities') === '1' ? (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded text-xs">
                <div className="font-semibold mb-2">Diagnostics: possible training-load keys per activity</div>
                {periodActivities.slice(0,8).map(act => {
                  const entries = Object.entries(act || {});
                  const candidates = entries
                    .filter(([k,_v]) => /load|tl|trimp|work|session|loadscore|load_score|training/i.test(k))
                    .map(([k,_v]) => {
                      let parsed = null;
                      const v = _v;
                      if (v != null) {
                        if (typeof v === 'number') parsed = v;
                        else if (typeof v === 'string') {
                          const cleaned = v.replace(/[\s,]+/g,'').replace(/[^0-9.-]/g,'');
                          const n = Number(cleaned);
                          if (!Number.isNaN(n)) parsed = n;
                        }
                      }
                      return { key: k, raw: v, parsed };
                    });
                  return (
                    <div key={act.activity_id || Math.random()} className="mb-2">
                      <div className="font-medium">{act.activity_id || act.start_time || '(no id)'}</div>
                      {candidates.length === 0 ? <div className="text-[12px] text-gray-600 dark:text-gray-300">No load-like keys found</div> : (
                        <ul className="text-[12px] list-disc ml-4">
                          {candidates.map(c => <li key={c.key}><strong>{c.key}</strong>: {String(c.raw)} → parsed: {c.parsed != null ? String(c.parsed) : 'n/a'}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
                <div className="text-[11px] text-gray-500 mt-2">If you see a key with a numeric parsed value (e.g. <code>training_load</code> or <code>tl</code>), paste that key name here and I'll add it to the aggregator.</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Latest Activities List */}
        <div className="card mt-6">
          <div className="card-header flex justify-between items-center flex-wrap gap-3">
            <h3 className="card-title">Latest Activities</h3>
            <div className="text-[11px] text-gray-500">Sorted by {sortKey.replace('_',' ')} ({sortDir})</div>
          </div>
          <div className="card-content">
            <div className="flex flex-wrap gap-4 mb-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sport</label>
                <select value={filterSport} onChange={e => setFilterSport(e.target.value)} className="select select-sm">
                  <option value="">All</option>
                  {uniqueSports.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or sport" className="input input-sm" />
              </div>
              <div className="text-xs text-gray-500 ml-auto">Showing {sorted.length} / {periodActivities.length} (last {periodDays}d)</div>
            </div>
            {activities.length === 0 ? (
                <div className="no-data">No activities in last {periodDays} days</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-gray-50 dark:bg-gray-800/40 sticky top-0">
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('start_time')}>Date {sortKey==='start_time' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('name')}>Name {sortKey==='name' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('sport')}>Sport {sortKey==='sport' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('distance_km')}>Distance {sortKey==='distance_km' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('duration_min')}>Duration {sortKey==='duration_min' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('avg_hr')}>Avg HR {sortKey==='avg_hr' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                      <th className="py-2 pr-4 cursor-pointer" onClick={() => toggleSort('calories')}>Calories {sortKey==='calories' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a) => (
                      <tr key={a.activity_id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 pr-4">{a.start_time ? new Date(a.start_time).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4">
                          <Link className="text-blue-600" to={`/activity/${a.activity_id}`}>{a.name || 'Activity'}</Link>
                        </td>
                        <td className="py-2 pr-4">{a.sport || '-'}</td>
                        <td className="py-2 pr-4">{a.distance_km != null ? `${a.distance_km} km` : '-'}</td>
                        <td className="py-2 pr-4">{a.duration_min != null ? `${a.duration_min} min` : '-'}</td>
                        <td className="py-2 pr-4">{a.avg_hr || '-'}</td>
                        <td className="py-2 pr-4">{a.calories || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .overview-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
        @media (max-width: 640px){ .overview-metrics { grid-template-columns: 1fr 1fr; } }

        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .header-content { flex: 1; }
        .page-title { font-size: 1.75rem; margin: 0 0 8px 0; }
        .page-subtitle { margin: 0; color: #64748b; }
        .header-controls { display: flex; gap: 12px; align-items: center; }
        .period-select, .date-range-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; color: #1e293b; font-size: 0.9rem; }
        .dark .period-select, .dark .date-range-select { background: #334155; border-color: #475569; color: #f1f5f9; }
        .header-links { display: flex; gap: 8px; }
  /* Weekly Trends table adjustments for better contrast */
  table.min-w-full thead tr { border-bottom: 1px solid rgba(15,23,42,0.08); }
  table.min-w-full th { padding: 10px 12px; background-clip: padding-box; font-weight: 600; }
  table.min-w-full td { padding: 10px 12px; font-weight: 500; }
  table.min-w-full tbody tr { border-bottom: 1px solid rgba(15,23,42,0.06); }
  /* stronger alternating rows */
  table.min-w-full tbody tr:nth-child(odd) { background: rgba(255,255,255,1); }
  table.min-w-full tbody tr:nth-child(even) { background: rgba(247,250,252,1); }
  .dark table.min-w-full tbody tr:nth-child(odd) { background: rgba(6,10,15,1); }
  .dark table.min-w-full tbody tr:nth-child(even) { background: rgba(10,14,20,0.95); }
  /* stronger text colors for improved legibility */
  table.min-w-full, table.min-w-full th, table.min-w-full td { color: #071028; }
  .dark table.min-w-full, .dark table.min-w-full th, .dark table.min-w-full td { color: #e6eef8; }
  /* sticky left column must be opaque */
  table.min-w-full th.sticky, table.min-w-full td.sticky { background: white; }
  .dark table.min-w-full th.sticky, .dark table.min-w-full td.sticky { background: #071028; }
      `}</style>
    </div>
  );
};

export default Activity;