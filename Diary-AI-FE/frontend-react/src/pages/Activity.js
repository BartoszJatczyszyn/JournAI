import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { Button } from '../components/ui';
import { activitiesAPI } from '../services';
import Sparkline from '../components/Sparkline';
import useActivityAggregates from '../hooks/useActivityAggregates';
import MetricCard from '../components/MetricCard';
import SegmentedControl from '../components/SegmentedControl';
import { formatPaceMinPerKm, parsePaceToMinutes, paceMinPerKm, durationToMinutes } from '../utils/timeUtils';
import DistanceHistogramByDay from '../components/DistanceHistogramByDay';
// Advanced running-specific analytics (trend comparison, predictions, simulations)
// have been moved to the dedicated Running page.

const Activity = () => {
  const { error, dashboardData, fetchDashboardForDays, fetchDashboardForRange } = useHealthData();
  const [activities, setActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(400); // dynamic based on selected period
  const [periodDays, setPeriodDays] = useState(() => {
    const raw = localStorage.getItem('activityPeriodDays');
    const parsed = Number(raw);
    return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30;
  }); // 7 | 14 | 30 | 60 | 90 | 180 | 365

  const [filterSport, setFilterSport] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('start_time');
  const [sortDir, setSortDir] = useState('desc');
  const [dailyStepsGoal, setDailyStepsGoal] = useState(() => Number(localStorage.getItem('dailyStepsGoal')) || 10000);
  const [weeklyDistanceGoal, setWeeklyDistanceGoal] = useState(() => Number(localStorage.getItem('weeklyDistanceGoal')) || 50);
  const [editingGoal, setEditingGoal] = useState(null); // 'steps' | 'distance' | null
  const [dateRangeMode, setDateRangeMode] = useState('rolling'); // 'rolling' | 'explicit'
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

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

  // If user switches date mode or edits explicit range, refresh activities
  useEffect(() => {
    // when user toggles mode or edits explicit range, ensure we have fresh activities
    // only trigger when explicit range has both endpoints or when switching back to rolling
    if (dateRangeMode === 'explicit') {
      if (rangeStart && rangeEnd) {
        loadActivities({ limit });
      }
    } else {
      // rolling
      loadActivities({ limit });
    }
  }, [dateRangeMode, rangeStart, rangeEnd, loadActivities, limit]);

  // Adjust fetch limit when period changes (heuristic mapping)
  useEffect(() => {
  const map = { 7: 100, 14: 200, 30: 400, 60: 800, 90: 1000, 180: 2000, 365: 3000 };
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
    try {
      if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
        const start = new Date(rangeStart);
        const end = new Date(rangeEnd);
        // inclusive end of day
        end.setHours(23,59,59,999);
        const startTs = start.getTime();
        const endTs = end.getTime();
        if (Number.isNaN(startTs) || Number.isNaN(endTs)) return [];
        return activities.filter(a => {
          if (!a.start_time) return false;
          const t = new Date(a.start_time).getTime();
          return !Number.isNaN(t) && t >= startTs && t <= endTs;
        });
      }
      // default: rolling window based on periodDays ending now
      const now = Date.now();
      const cutoff = now - periodDays * 24 * 60 * 60 * 1000;
      return activities.filter(a => {
        if (!a.start_time) return false;
        const t = new Date(a.start_time).getTime();
        return !Number.isNaN(t) && t >= cutoff && t <= now;
      });
    } catch (e) {
      return [];
    }
  }, [activities, periodDays, dateRangeMode, rangeStart, rangeEnd]);

  const uniqueSports = useMemo(() => {
    const set = new Set();
    periodActivities.forEach(a => { if (a.sport) set.add(a.sport); });
    return Array.from(set).sort();
  }, [periodActivities]);

  const {
  todaySteps,
    weeklySteps,
    weeklyDistance,
  // activeDays intentionally unused in this view
    lastNDaysSeries,
    weeklyGroups,
    pickSteps
  } = useActivityAggregates(periodActivities, { lastNDays: Math.min(periodDays, 90) });

  // Robust extractor: try pickSteps, common direct keys, then a shallow recursive
  // search for any property name containing "step" (arrays/objects allowed).
  const findStepsInObj = useCallback((obj) => {
    if (!obj || typeof obj !== 'object') return null;
    // prefer hook-provided picker
    const viaPick = pickSteps ? pickSteps(obj) : null;
    if (viaPick != null && !Number.isNaN(Number(viaPick))) return Number(viaPick);

    const toNumber = (v) => {
      if (v == null) return NaN;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[\s,]+/g, '').replace(/[^0-9.-]/g, '');
        return Number(cleaned);
      }
      return NaN;
    };

    // quick direct keys
    const direct = ['steps','total_steps','step_count','daily_steps','totalSteps','stepCount','steps_total'];
    for (const k of direct) {
      if (k in obj) {
        const n = toNumber(obj[k]);
        if (!Number.isNaN(n)) return n;
      }
    }

    // shallow recursive search (limit depth to avoid pathological objects)
    const seen = new Set();
    const stack = [{ val: obj, depth: 0 }];
    while (stack.length) {
      const { val, depth } = stack.pop();
      if (!val || typeof val !== 'object' || seen.has(val)) continue;
      seen.add(val);
      if (Array.isArray(val)) {
        for (const it of val) stack.push({ val: it, depth: depth + 1 });
        continue;
      }
      if (depth > 3) continue;
      for (const [k, v] of Object.entries(val)) {
        if (/step/i.test(k)) {
          const n = toNumber(v);
          if (!Number.isNaN(n)) return n;
        }
        if (v && typeof v === 'object') stack.push({ val: v, depth: depth + 1 });
      }
    }
    return null;
  }, [pickSteps]);

  // quick check whether an activity should contribute steps (only running/walking)
  const isStepSport = (act) => {
    if (!act) return false;
    const hintParts = [];
    const tryPush = (v) => { if (v != null) hintParts.push(String(v)); };
    tryPush(act.sport);
    tryPush(act.sub_sport);
    tryPush(act.name);
    tryPush(act.type);
    tryPush(act.activity_type);
    tryPush(act.workout_type);
    tryPush(act.workout_name);
    tryPush(act.description);
    if (Array.isArray(act.tags)) hintParts.push(...act.tags.map(t => String(t)));
    const hint = hintParts.join(' | ').toLowerCase();
    if (!hint) return false;
    if (hint.includes('run') || hint.includes('jog') || hint.includes('tempo') || hint.includes('fartlek')) return true;
    if (hint.includes('hike') || hint.includes('walk') || hint.includes('trek') || hint.includes('stroll')) return true;
    return false;
  };

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
        // Prefer normalized parse result if provided by context
        const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
        if (!d || isNaN(d.getTime())) return;
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


  // Fallback: if activity objects lack step data, derive from health dashboard daily entries
  const { fallbackTodaySteps } = React.useMemo(() => {
    if (todaySteps > 0 && weeklySteps > 0) return { fallbackTodaySteps: 0 };
    const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
    if (!Array.isArray(rows) || rows.length === 0) return { fallbackTodaySteps: 0, fallbackWeeklySteps: 0 };
    const todayKey = new Date().toISOString().slice(0,10);
    let todayVal = 0;
  rows.forEach(r => {
  const rawDate = r.day || r.date || r.timestamp || r.day_date;
  const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
  if (!d) return;
  const key = d.toISOString().slice(0,10);
      const stepsVal = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
      if (key === todayKey) todayVal = Math.max(todayVal, stepsVal); // if multiple entries, take max
    });
    return { fallbackTodaySteps: todaySteps > 0 ? 0 : todayVal };
  }, [todaySteps, weeklySteps, dashboardData]);

  const displayTodaySteps = todaySteps > 0 ? todaySteps : fallbackTodaySteps;
  // compute how many days are in the current display window
  const displayDays = useMemo(() => {
    try {
      if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
        const s = new Date(rangeStart);
        const e = new Date(rangeEnd);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return Math.max(1, Number(periodDays));
        // inclusive days
        const diff = Math.floor((e.setHours(23,59,59,999) - s.setHours(0,0,0,0)) / (24 * 60 * 60 * 1000)) + 1;
        return Math.max(1, diff);
      }
      return Math.max(1, Number(periodDays) || 1);
    } catch (e) {
      return Math.max(1, Number(periodDays) || 1);
    }
  }, [dateRangeMode, rangeStart, rangeEnd, periodDays]);

  // Display label now always shows the count of days (e.g. "44d") even for explicit ranges.
  const displayLabel = useMemo(() => `${displayDays}d`, [displayDays]);

  // Ensure dashboard window data covers the explicit selected range so
  // periodStepsFallback can derive steps from the health rows when needed.
  useEffect(() => {
    try {
      if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
        // Use new historical range fetch (works for past ranges not ending today)
        fetchDashboardForRange(rangeStart, rangeEnd);
      }
    } catch (err) {
      console.warn('Failed to refresh dashboard for explicit range', err);
    }
  }, [dateRangeMode, rangeStart, rangeEnd, fetchDashboardForRange]);

  // Debug helper: when localStorage.debugShowSteps === '1', print samples
  // of periodActivities and dashboard rows to help trace why steps fallback
  // for explicit ranges may be returning zero.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('debugShowSteps') !== '1') return;
      if (!(dateRangeMode === 'explicit' && rangeStart && rangeEnd)) return;
      const s = new Date(rangeStart);
      const e = new Date(rangeEnd);
      e.setHours(23,59,59,999);
      console.group('DEBUG: Activity steps range check');
      console.log('Selected range', { rangeStart, rangeEnd, startTs: s.getTime(), endTs: e.getTime() });
      console.log('Period activities (sample 0..5):', periodActivities.slice(0,6));
      console.log('Dashboard windowData (sample 0..10):', dashboardData?.windowData?.slice(0,10));
      const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
      const matched = rows.filter(r => {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= s.getTime() && t <= e.getTime();
      });
      console.log('Dashboard rows matched to range:', matched.length, matched.slice(0,8));
      console.groupEnd();
    } catch (err) {
      console.warn('DEBUG logging failed', err);
    }
  }, [dateRangeMode, rangeStart, rangeEnd, dashboardData, periodActivities]);

  // Compute dashboard rows that match the explicit range so we can render a
  // visible debug panel (useful when users cannot access DevTools).
  const matchedDashboardRows = useMemo(() => {
    try {
      if (!(dateRangeMode === 'explicit' && rangeStart && rangeEnd)) return [];
      const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
      const s = new Date(rangeStart);
      const e = new Date(rangeEnd);
      e.setHours(23,59,59,999);
      const sTs = s.getTime();
      const eTs = e.getTime();
      if (Number.isNaN(sTs) || Number.isNaN(eTs)) return [];
      return rows.filter(r => {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= sTs && t <= eTs;
      });
    } catch (err) {
      return [];
    }
  }, [dateRangeMode, rangeStart, rangeEnd, dashboardData]);
  const [sparkMetric, setSparkMetric] = useState('distance'); // 'distance' | 'steps' | 'calories'
  const initialWeeks = Math.min(Math.max(1, Math.ceil(periodDays / 7)), 52);
  const [weeksRange /*, setWeeksRange */] = useState(initialWeeks); // adapts to selected period (weeks)
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

  // Period-level aggregates (adapt to selected periodDays)
  const periodTotals = useMemo(() => {
    try {
      const totals = { distance: 0, durationMin: 0, calories: 0, steps: 0 };

      // use findStepsInObj helper defined in outer scope

      periodActivities.forEach(a => {
        totals.distance += Number(a.distance_km) || 0;
        totals.durationMin += Number(a.duration_min) || 0;
        totals.calories += Number(a.calories) || 0;
        // only count steps for running/walking activities
        if (isStepSport(a)) {
          const s = findStepsInObj(a);
          totals.steps += (s != null ? s : 0);
        }
      });
      return totals;
    } catch (e) {
      return { distance:0, durationMin:0, calories:0, steps:0 };
    }
  }, [periodActivities, findStepsInObj]);

  // Fallback: if activities don't contain steps, try to derive period steps from dashboardData rows
  const periodStepsFallback = useMemo(() => {
    try {
      const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
      if (!Array.isArray(rows) || rows.length === 0) return 0;
      let sum = 0;
      if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) {
        const s = new Date(rangeStart);
        const e = new Date(rangeEnd);
        e.setHours(23,59,59,999);
        const sTs = s.getTime();
        const eTs = e.getTime();
        if (Number.isNaN(sTs) || Number.isNaN(eTs)) return 0;
        for (const r of rows) {
          const rawDate = r.day || r.date || r.timestamp || r.day_date;
          const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
          if (!d || isNaN(d.getTime())) continue;
          const t = d.getTime();
          if (t < sTs || t > eTs) continue;
          const stepsVal = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
          sum += stepsVal;
        }
        return sum;
      }
      const now = Date.now();
      const cutoff = now - periodDays * 24 * 60 * 60 * 1000;
      for (const r of rows) {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
        if (!d || isNaN(d.getTime())) continue;
        const t = d.getTime();
        if (t < cutoff || t > now) continue;
        const stepsVal = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
        sum += stepsVal;
      }
      return sum;
    } catch (e) {
      return 0;
    }
  }, [dashboardData, periodDays, dateRangeMode, rangeStart, rangeEnd]);

  const avgPerDay = useMemo(() => {
    const days = displayDays;
    const stepsTotal = (periodTotals.steps && periodTotals.steps > 0) ? periodTotals.steps : periodStepsFallback;
    return {
      distance: periodTotals.distance / days,
      durationMin: periodTotals.durationMin / days,
      steps: Math.round((stepsTotal || 0) / days),
      calories: periodTotals.calories / days
    };
  }, [periodTotals, displayDays, periodStepsFallback]);

  const stepsTotal = (periodTotals.steps && periodTotals.steps > 0) ? periodTotals.steps : (periodStepsFallback || 0);

  // Format minutes into hours + minutes (e.g. 125 -> "2h 5m")
  const formatHoursMinutes = (mins) => {
    const m = Math.round(Number(mins) || 0);
    const h = Math.floor(m / 60);
    const r = Math.abs(m % 60);
    return `${h}h ${String(r).padStart(2,'0')}m`;
  };

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

  // Quick navigation cards to related activity pages (colorful, iconified)
  const quickLinks = [
    { to: '/running', label: 'Running', icon: '🏃‍♂️', gradientIcon: 'linear-gradient(135deg,#fb7185,#ef4444)', cardBg: 'linear-gradient(90deg, rgba(239,68,68,0.06), rgba(251,113,133,0.03))', accent: '#ef4444' },
    { to: '/walking', label: 'Walking', icon: '🚶‍♀️', gradientIcon: 'linear-gradient(135deg,#34d399,#10b981)', cardBg: 'linear-gradient(90deg, rgba(16,185,129,0.06), rgba(52,211,153,0.03))', accent: '#10b981' },
  { to: '/cycling', label: 'Rower', icon: '🚴‍♂️', gradientIcon: 'linear-gradient(135deg,#a78bfa,#6366f1)', cardBg: 'linear-gradient(90deg, rgba(99,102,241,0.06), rgba(167,139,250,0.03))', accent: '#6366f1' },
    { to: '/hiking', label: 'Hiking', icon: '🥾', gradientIcon: 'linear-gradient(135deg,#fbbf24,#f59e0b)', cardBg: 'linear-gradient(90deg, rgba(245,158,11,0.06), rgba(251,191,36,0.03))', accent: '#f59e0b' },
    { to: '/swimming', label: 'Swimming', icon: '🏊‍♀️', gradientIcon: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', cardBg: 'linear-gradient(90deg, rgba(14,165,233,0.06), rgba(56,189,248,0.03))', accent: '#0ea5e9' },
    { to: '/gym', label: 'Gym', icon: '🏋️‍♀️', gradientIcon: 'linear-gradient(135deg,#a78bfa,#7c3aed)', cardBg: 'linear-gradient(90deg, rgba(124,58,237,0.06), rgba(167,139,250,0.03))', accent: '#7c3aed' }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">Track your general daily & weekly activity.</p>
        </div>
        <div className="toolbar flex gap-2 mt-2 flex-wrap items-center">
          <div className="flex gap-2 items-center">
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
            <Button aria-label="Refresh activities" variant="primary" disabled={busy} onClick={() => loadActivities({ limit })}>{busy ? 'Loading...' : 'Refresh'}</Button>
            <div className="flex items-center gap-2 ml-4 text-xs">
              <select value={dateRangeMode} onChange={e=>setDateRangeMode(e.target.value)} className="select select-sm">
                <option value="rolling">Rolling</option>
                <option value="explicit">Range</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      {/* Quick navigation cards to specific activity pages */}
      <div className="quick-links-grid mt-4 mb-6">
        {quickLinks.map(l => (
          <Link key={l.to} to={l.to} className={`quick-card group`} title={l.label} style={{ background: l.cardBg }}>
            <div className={`icon text-white rounded-xl w-12 h-12 flex items-center justify-center text-xl shadow-md`} style={{ background: l.gradientIcon }}>{l.icon}</div>
            <div className="ml-3">
              <div className="font-semibold" style={{ color: l.accent }}>{l.label}</div>
              <div className="text-xs text-gray-500">Open {l.label} analytics</div>
            </div>
          </Link>
        ))}
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
              title={`Active Minutes (${displayLabel})`}
              value={formatHoursMinutes(periodTotals.durationMin)}
              unit=""
              icon="⏱️"
              color="green"
              subtitle={`Avg ${formatHoursMinutes(avgPerDay.durationMin)} / day`}
              tooltip={`Sum of activity durations over the last ${displayLabel}`}
            />
            <MetricCard
              title={`Distance (${displayLabel})`}
              value={periodTotals.distance.toFixed(2)}
              unit="km"
              icon="📏"
              color="indigo"
              subtitle={`Avg ${avgPerDay.distance.toFixed(2)} km/day`}
            />
            <MetricCard
              title={`Workouts (${displayLabel})`}
              value={periodActivities.length}
              unit=""
              icon="🏋️"
              color="purple"
              subtitle={`Avg ${(periodActivities.length/Math.max(1, displayDays)).toFixed(2)} /day · Avg ${periodActivities.length ? (periodTotals.durationMin / periodActivities.length).toFixed(0) : '0'} min/session`}
            />
            <MetricCard
              title={`Steps (${displayLabel})`}
              value={stepsTotal.toLocaleString()}
              unit=""
              icon="📊"
              color="blue"
              subtitle={`Avg ${avgPerDay.steps.toLocaleString()} / day`}
            />
          </div>

          {/* Activity Goals moved to bottom */}
  </div>

          {/* Daily totals histogram for all activities */}
          <div className="card mt-6">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Daily totals: Distance distribution (all activities)</h3>
              <div className="text-[11px] text-gray-500">bins (daily summed distance) · days · km/h</div>
            </div>
            <div className="card-content">
                      {/* Include running, walking, hiking and cycling distances explicitly */}
                      {(() => {
                        const includeSports = new Set(['running','walking','hiking','cycling']);
                        const histActs = periodActivities.filter(a => {
                          if (a.distance_km == null) return false;
                          const sp = (a.sport || '').toLowerCase();
                          return includeSports.has(sp);
                        });
                        return <DistanceHistogramByDay activities={histActs} sport="all" binWidth={5} maxBins={12} height={240} />;
                      })()}
            </div>
          </div>

            {/* Top-5 days per sport (distance / activity count / fastest pace / steps / active minutes) */}
            <div className="card mt-6">
              <div className="card-header flex items-center justify-between">
                <h3 className="card-title">Top 5 days by metric (Cycling · running · walking/hiking)</h3>
                <div className="text-[11px] text-gray-500">Per-day aggregates within selected period</div>
              </div>
              <div className="card-content">
                {periodActivities.length === 0 ? (
                  <div className="text-sm text-gray-500">No activities in the selected period.</div>
                ) : (
                  (() => {

                    // Helper: normalize sport into one of 'cycling','running','walking','swimming','gym'
                    const normalizeSport = (s) => {
                      if (!s) return null;
                      const x = String(s).toLowerCase().trim();
                      // cycling variants (road, gravel, indoor, spin, ebike, commute, ride)
                      if (x.includes('cycle') || x.includes('bike') || x.includes('ride') || x.includes('biking') || x.includes('road') || x.includes('gravel') || x.includes('spin') || x.includes('trainer') || x.includes('indoor') || x.includes('ebike') || x.includes('e-bike') || x.includes('commute') || x.includes('virtual')) return 'cycling';
                      // running
                      if (x.includes('run') || x.includes('jog') || x.includes('tempo') || x.includes('fartlek')) return 'running';
                      // walking / hiking
                      if (x.includes('hike') || x.includes('walk') || x.includes('trek') || x.includes('stroll')) return 'walking';
                      // swimming
                      if (x.includes('swim') || x.includes('pool') || x.includes('openwater')) return 'swimming';
                      // gym / strength / crossfit / lifting / workout / fitness equipment
                      if (x.includes('gym') || x.includes('strength') || x.includes('weight') || x.includes('lift') || x.includes('crossfit') || x.includes('workout') || x.includes('resistance') || x.includes('fitness') || x.includes('fitness_equipment') || x.includes('fitness-equipment') || x.includes('fitness equipment')) return 'gym';
                      return null;
                    };

                    // ...existing code...

                    // Build map: sport -> date -> aggregates
                    const sports = ['cycling','running','walking','swimming','gym'];
                    const map = { cycling: new Map(), running: new Map(), walking: new Map(), swimming: new Map(), gym: new Map() };

                    // Build a multi-field hint string from common activity fields so
                    // classification works even when `sport` is empty.
                    const buildSportHint = (act) => {
                      if (!act || typeof act !== 'object') return '';
                      const parts = [];
                      const tryPush = (v) => { if (v != null) parts.push(String(v)); };
                      tryPush(act.sport);
                      tryPush(act.sub_sport);
                      tryPush(act.name);
                      tryPush(act.type);
                      tryPush(act.activity_type);
                      tryPush(act.workout_type);
                      tryPush(act.workout_name);
                      tryPush(act.description);
                      if (Array.isArray(act.tags)) parts.push(...act.tags.map(t => String(t)));
                      if (act.metadata && typeof act.metadata === 'object') tryPush(JSON.stringify(act.metadata));
                      return parts.filter(Boolean).join(' | ');
                    };

                    periodActivities.forEach(a => {
                      // try many fields (sport, name, tags, type, metadata) to classify
                      // activities where sport may be empty or ambiguous
                      const rawSportHint = buildSportHint(a) || '';
                      const sportKey = normalizeSport(rawSportHint);
                      if (!sportKey || !sports.includes(sportKey)) return;
                      if (!a.start_time) return;
                      const d = new Date(a.start_time);
                      if (isNaN(d.getTime())) return;
                      const iso = d.toISOString().slice(0,10);
                      const dayMap = map[sportKey];
                      const entry = dayMap.get(iso) || { distance: 0, count: 0, paceSum: 0, paceCount: 0, minPace: null, minPaceActivityId: null, minPaceRaw: null, minPaceDistance: null, steps: 0, durationMin: 0 };

                      const dist = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : 0);
                      const dur = (a.duration_min != null && Number.isFinite(Number(a.duration_min))) ? Number(a.duration_min) : (durationToMinutes(a) || 0);

                      // activity-level pace (min/km)
                      let activityPace = null;
                      const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
                      if (rawPace != null) {
                        const p = parsePaceToMinutes(rawPace);
                        if (p != null && Number.isFinite(p) && p > 0) activityPace = p;
                      }
                      if (activityPace == null && dist > 0 && dur > 0) {
                        const p2 = paceMinPerKm(dist, dur);
                        if (p2 != null && Number.isFinite(p2) && p2 > 0) activityPace = p2;
                      }

                      entry.distance += dist && Number.isFinite(dist) ? dist : 0;
                      entry.count += 1;
                      entry.durationMin += dur;
                      if (activityPace != null) {
                        entry.paceSum += activityPace; entry.paceCount += 1;
                        if (entry.minPace == null || activityPace < entry.minPace) {
                          entry.minPace = activityPace;
                          entry.minPaceActivityId = a.activity_id || a.id || null;
                          entry.minPaceRaw = rawPace;
                          entry.minPaceDistance = dist != null && Number.isFinite(Number(dist)) ? Number(dist) : null;
                        }
                      }
                      const sVal = findStepsInObj(a);
                      if (sVal != null && Number.isFinite(Number(sVal))) entry.steps += Number(sVal);

                      dayMap.set(iso, entry);
                    });

                    // helper to convert maps to arrays and compute averages
                    // helper to convert maps to arrays and compute averages
                    // If activities lack steps, try to supplement from dashboardData rows
                    const pickDashboardStepsForDate = (isoDate) => {
                      try {
                        const rows = (dashboardData?.healthData?.all) || (dashboardData?.windowData) || [];
                        if (!Array.isArray(rows) || rows.length === 0) return null;
                        let best = null;
                        for (const r of rows) {
                          const rawDate = r.day || r.date || r.timestamp || r.day_date;
                          const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
                          if (!d || isNaN(d.getTime())) continue;
                          const key = d.toISOString().slice(0,10);
                          if (key !== isoDate) continue;
                          const val = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
                          if (val > 0 && (best == null || val > best)) best = val;
                        }
                        return best;
                      } catch (e) {
                        return null;
                      }
                    };

                    const buildArrays = (dayMap) => {
                      // supplement dayMap steps with dashboard data when missing/zero
                      // but only for running/walking sport buckets
                      for (const [iso, entry] of dayMap.entries()) {
                        if ((!entry.steps || entry.steps === 0)) {
                          const fromDash = pickDashboardStepsForDate(iso);
                          if (fromDash != null && fromDash > 0) entry.steps = fromDash;
                        }
                      }
                      return Array.from(dayMap.entries()).map(([date, v]) => ({
                        date,
                        distance: Number(Number(v.distance).toFixed(3)),
                        count: v.count,
                        // prefer fastest activity pace for the day (minPace) if available
                        avgPace: v.minPace != null ? v.minPace : (v.paceCount ? (v.paceSum / v.paceCount) : null),
                        steps: v.steps,
                        durationMin: v.durationMin,
                        minPaceActivityId: v.minPaceActivityId,
                        minPaceRaw: v.minPaceRaw,
                        minPaceDistance: v.minPaceDistance
                      }));
                    };

                    const buildArraysNoSupplement = (dayMap) => {
                      return Array.from(dayMap.entries()).map(([date, v]) => ({
                        date,
                        distance: Number(Number(v.distance).toFixed(3)),
                        count: v.count,
                        avgPace: v.paceCount ? (v.paceSum / v.paceCount) : null,
                        steps: v.steps,
                        durationMin: v.durationMin,
                        minPaceDistance: v.minPaceDistance
                      }));
                    };

                    const cyclingArr = buildArraysNoSupplement(map.cycling);
                    const runningArr = buildArrays(map.running);
                    const walkingArr = buildArrays(map.walking);
                    const swimmingArr = buildArraysNoSupplement(map.swimming);
                    const gymArr = buildArraysNoSupplement(map.gym);

                    // Debug: log counts per sport and distinct raw sport names + samples of unclassified hints
                    try {
                      const counts = {};
                      for (const k of Object.keys(map)) counts[k] = map[k].size || 0;
                      console.debug('Top5 per-sport day buckets:', counts);

                      const rawSports = Array.from(new Set((periodActivities || []).map(a => (a.sport || '').toString()).filter(s => s.length > 0)));
                      console.debug('Distinct raw sport names in periodActivities:', rawSports.slice(0,200));

                      // build multi-field hints for activities and show some unclassified examples
                      const getSportHint = (act) => {
                        if (!act || typeof act !== 'object') return '';
                        const parts = [];
                        const tryPush = (v) => { if (v != null) parts.push(String(v)); };
                        tryPush(act.sport);
                        tryPush(act.sub_sport);
                        tryPush(act.name);
                        tryPush(act.type);
                        tryPush(act.activity_type);
                        tryPush(act.workout_type);
                        tryPush(act.workout_name);
                        tryPush(act.description);
                        if (Array.isArray(act.tags)) parts.push(...act.tags.map(t => String(t)));
                        if (act.metadata && typeof act.metadata === 'object') tryPush(JSON.stringify(act.metadata));
                        return parts.filter(Boolean).join(' | ');
                      };

                      const unclassified = [];
                      for (const act of (periodActivities || [])) {
                        const hint = getSportHint(act);
                        if (!hint) continue;
                        const key = normalizeSport(hint);
                        if (!key) {
                          unclassified.push({ id: act.activity_id || act.id || '(no-id)', hint, name: act.name || '', sport: act.sport || '' });
                          if (unclassified.length >= 20) break;
                        }
                      }
                      if (unclassified.length) console.debug('Sample unclassified activity hints (first 20):', unclassified);
                    } catch (e) {
                      // ignore
                    }

                    // Pace debug: show running day buckets and source activity ids when requested
                    try {
                      if (typeof window !== 'undefined' && localStorage.getItem('debugShowPace') === '1') {
                        console.debug('DEBUG: runningArr (date, avgPace, minPaceActivityId, minPaceRaw):', runningArr.map(r => ({ date: r.date, avgPace: r.avgPace, activityId: r.minPaceActivityId, raw: r.minPaceRaw }))); 
                      }
                    } catch (e) { /* ignore */ }

                    const topK = (arr, key, asc=false, n=5) => {
                      const filtered = arr.filter(x => x[key] != null && (typeof x[key] === 'number' ? Number.isFinite(x[key]) : true));
                      filtered.sort((a,b) => asc ? a[key] - b[key] : b[key] - a[key]);
                      return filtered.slice(0,n);
                    };

                    const metrics = [
                      { id: 'distance', title: 'Total distance (km)', fmt: v => v.toFixed(2) },
                      { id: 'count', title: 'Activity count', fmt: v => String(v) },
                      { id: 'avgPace', title: 'Avg pace (min/km) — fastest', fmt: v => formatPaceMinPerKm(v) , asc: true },
                      { id: 'steps', title: 'Steps', fmt: v => String(Math.round(v)) },
                      { id: 'durationMin', title: 'Active minutes', fmt: v => String(Math.round(v)) }
                    ];

                    const topFor = (arr, metric) => topK(arr, metric.id, !!metric.asc);

                    return (
                      <div className="space-y-4">
                        {metrics.map(metric => {
                          const tCycling = topFor(cyclingArr, metric);
                          const tRunning = topFor(runningArr, metric);
                          const tWalking = topFor(walkingArr, metric);
                          const tSwimming = topFor(swimmingArr, metric);
                          const tGym = topFor(gymArr, metric);
                          const formatDateShort = (d) => {
                            if (!d) return '';
                            try {
                              // Accept ISO date strings (YYYY-MM-DD) or Date-like values
                              const dt = (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(d) : new Date(d);
                              if (isNaN(dt.getTime())) return String(d);
                              const day = String(dt.getDate()).padStart(2,'0');
                              const month = String(dt.getMonth() + 1).padStart(2,'0');
                              const year = dt.getFullYear();
                              // Return in MM/DD/YYYY format
                              return `${month}/${day}/${year}`;
                            } catch (e) {
                              return String(d);
                            }
                          };

                          const cellText = (obj) => {
                            if (!obj) return '—';
                            const v = obj[metric.id];
                            // treat null/undefined or explicit zero as empty
                            if (v == null) return '—';
                            if (typeof v === 'number' && v === 0) return '—';
                            if (metric.id === 'avgPace') {
                              const paceStr = formatPaceMinPerKm(v);
                              const dist = obj.minPaceDistance != null ? ` (${obj.minPaceDistance.toFixed(2)} km)` : '';
                              return `${paceStr}${dist}`;
                            }
                            return metric.fmt(v);
                          };

                          return (
                            <div key={metric.id} className="border rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold">{metric.title}</div>
                                {metric.id === 'avgPace' ? <div className="text-xs text-gray-500">lower is better</div> : null}
                              </div>
                              <div className="overflow-auto">
                                <table className="min-w-full text-sm table-fixed">
                                  <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase">
                                      <th className="w-12 pr-4">#</th>
                                      <th className="pr-4">Cycling</th>
                                      <th className="pr-4">Running</th>
                                      <th className="pr-4">Walking &amp; Hiking</th>
                                      <th className="pr-4">Swimming</th>
                                      <th>Gym</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[0,1,2,3,4].map(i => {
                                      const c = tCycling[i];
                                      const r = tRunning[i];
                                      const w = tWalking[i];
                                      const s = tSwimming[i];
                                      const g = tGym[i];
                                      const cellFor = (sport) => (obj) => {
                                        if (!obj) return '—';
                                        const txt = cellText(obj);
                                        if (txt === '—') return '—';
                                        // For steps metric, append distance for running/walking/hiking
                                        if (metric.id === 'steps' && ['running','walking','hiking'].includes(sport)) {
                                          const dist = obj.distance != null && Number.isFinite(Number(obj.distance)) ? ` (${Number(obj.distance).toFixed(2)} km)` : '';
                                          return `${formatDateShort(obj.date)}: ${txt}${dist}`;
                                        }
                                        return `${formatDateShort(obj.date)}: ${txt}`;
                                      };
                                      return (
                                        <tr key={i} className="border-t">
                                          <td className="py-2 pr-4 font-medium">{i+1}</td>
                                          <td className="py-2 pr-4">{cellFor('cycling')(c)}</td>
                                          <td className="py-2 pr-4">{cellFor('running')(r)}</td>
                                          <td className="py-2 pr-4">{cellFor('walking')(w)}</td>
                                          <td className="py-2 pr-4">{cellFor('swimming')(s)}</td>
                                          <td className="py-2">{cellFor('gym')(g)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
  {/* Advanced charts & simulations removed. See Running Analytics page for forecasts and goal simulations. */}

        {/* Weekly Trends */}
        <div className="card mt-6">
          <div className="card-header flex flex-wrap gap-4 justify-between items-start">
            <div className="space-y-1">
              <h3 className="card-title">Weekly Trends</h3>
              <div className="text-[11px] text-gray-500">Distance, steps, calories, pacing & training load per ISO week (load derives from source fields or training effect × duration)</div>
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
                        <td className="py-2 px-3">{w.avgPace != null ? formatPaceMinPerKm(w.avgPace) : '-'}</td>
                        <td className="py-2 px-3">{w.rollingAvgPace4 != null ? formatPaceMinPerKm(w.rollingAvgPace4) : '-'}</td>
                        <td className={`py-2 px-3 ${w.paceImprovementPct != null ? (w.paceImprovementPct > 0 ? 'text-green-600' : w.paceImprovementPct < 0 ? 'text-red-600' : 'text-gray-500') : 'text-gray-400'}`}>{w.paceImprovementPct != null ? `${w.paceImprovementPct>0?'+':''}${w.paceImprovementPct.toFixed(1)}%` : '—'}</td>
                        <td className="py-2 px-3">{w.avgHr != null ? w.avgHr.toFixed(0) : '-'}</td>
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {typeof w.trainingLoad === 'number' ? (
                            <span className={w.trainingLoadSource === 'derived' ? 'text-indigo-600 dark:text-indigo-400' : ''} title={w.trainingLoadSource === 'derived' ? 'Derived from training_effect × duration (approximate)' : 'Explicit training load value'}>
                              {w.trainingLoad.toFixed(0)}{w.trainingLoadSource === 'derived' ? '*' : ''}
                            </span>
                          ) : '-'}
                        </td>
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
            {typeof window !== 'undefined' && localStorage.getItem('debugShowSteps') === '1' ? (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-xs">
                <div className="font-semibold mb-2">DEBUG: Dashboard rows matching explicit range</div>
                <div className="text-[12px] text-gray-700 dark:text-gray-200 mb-2">Matched rows: <strong>{matchedDashboardRows.length}</strong></div>
                <div className="text-[12px] text-gray-600 dark:text-gray-300 mb-2">Sample keys (first row):</div>
                {matchedDashboardRows.length > 0 ? (
                  <pre style={{maxHeight: 220, overflow: 'auto'}}>{JSON.stringify(matchedDashboardRows.slice(0,6).map(r => Object.keys(r)), null, 2)}</pre>
                ) : (
                  <div className="text-[12px] text-gray-500">No matching dashboard rows for the selected explicit range.</div>
                )}
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
        {/* Activity Goals (moved to bottom) */}
        <div className="card mt-6">
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
                {/* Ensure series is explicitly chronological (oldest -> newest) so newest appears on the right */}
                {/**/}
                <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">{lastNDaysSeries.length}-Day Trend</span>
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
                {/* use explicit chronological ordering to guarantee left->right oldest->newest */}
                <Sparkline
                  data={[...lastNDaysSeries].sort((a,b) => new Date(a.date) - new Date(b.date)).map(p => ({ value: p[sparkMetric] }))}
                  height={46}
                  stroke={sparkMetric==='distance' ? '#10b981' : sparkMetric==='steps' ? '#6366f1' : '#f59e0b'}
                  fill={sparkMetric==='calories' ? 'rgba(245,158,11,0.18)' : sparkMetric==='steps' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}
                  tooltipFormatter={(pt,i)=>{
                    const series = [...lastNDaysSeries].sort((a,b) => new Date(a.date) - new Date(b.date));
                    return `${series[i]?.date || ''}: ${sparkMetric==='distance'? pt.value.toFixed(2)+' km' : sparkMetric==='steps'? pt.value.toLocaleString()+' steps' : pt.value.toLocaleString()+' kcal'}`;
                  }}
                />
              </div>
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

      <style jsx>{`
        .quick-links-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        .quick-card { display:flex; align-items:center; padding:10px; border-radius:12px; background:var(--card-bg, #fff); text-decoration:none; color:inherit; box-shadow:0 1px 3px rgba(16,24,40,0.04); border:1px solid rgba(15,23,42,0.04); transition:transform .12s ease, box-shadow .12s ease; }
        .quick-card:hover { transform:translateY(-4px); box-shadow:0 6px 20px rgba(16,24,40,0.08); }
        .quick-card .icon { flex:0 0 auto; }
        .quick-card .ml-3 { margin-left:12px; }
        @media (max-width:640px) { .quick-links-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
};

export default Activity;