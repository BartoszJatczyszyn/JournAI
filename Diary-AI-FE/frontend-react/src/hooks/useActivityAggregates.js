import { useMemo } from 'react';
import { durationToMinutes, parsePaceToMinutes } from '../utils/timeUtils';

// Helper to sum values
const sum = (arr, sel) => arr.reduce((acc, x) => acc + (Number(sel(x)) || 0), 0);

// Derive possible steps field (support multiple backend naming variants)
const pickSteps = (a) => {
  if (!a || typeof a !== 'object') return null;
  const candidates = [
    a.steps,
    a.total_steps,
    a.step_count,
    a.totalSteps,
    a.stepCount,
    a.steps_total,
    a.daily_steps,
    a.dailySteps,
    // nested summary objects (defensive)
    a.summary?.steps,
    a.metrics?.steps
  ];
  for (const v of candidates) {
    if (v == null) continue;
    const n = toNumberSafe(v);
    if (n != null) return n;
  }
  return null;
};

// Derive training load from several possible backend field names
const pickTrainingLoad = (a) => {
  if (!a || typeof a !== 'object') return null;
  const candidates = [
    a.training_load,
    a.trainingLoad,
    a.training_load_value,
    a.training_load_score,
    a.training_load_total,
    a.trainingLoadScore,
    a.trainingLoadValue,
    a.training_load_est,
    a.trainingload,
    a.load_score,
    a.loadScore,
    a.workload,
    a.work_load,
    a.workLoad,
    a.trimp,
    a.session_load,
    a.sessionLoad
  ];
  for (const v of candidates) {
    if (v == null) continue;
    const n = toNumberSafe(v);
    if (n != null) return n;
  }
  return null;
};


// Generic scanner: look for numeric fields whose key matches any of the provided regexes
const findNumericFieldByPattern = (obj, patterns) => {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    try {
      for (const p of patterns) {
        if (new RegExp(p, 'i').test(key)) {
          const v = obj[key];
          const n = toNumberSafe(v);
          if (n != null) return n;
        }
      }
    } catch (e) {
      // ignore invalid regex
    }
  }
  // Check nested objects shallowly (e.g. summary, metrics)
  for (const k of ['summary','metrics','stats']) {
    if (obj[k] && typeof obj[k] === 'object') {
      const nested = findNumericFieldByPattern(obj[k], patterns);
      if (nested != null) return nested;
    }
  }
  return null;
};

// Safely convert various numeric representations (strings with commas, spaces) to Number
const toNumberSafe = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    // remove common thousands separators and non-numeric chars except dot and minus
  const cleaned = v.replace(/[\s,]+/g, '').replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  // fallback for booleans etc.
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// Hook computing derived metrics for activities
export const useActivityAggregates = (activities, opts = {}) => {
  const lastNDays = Number(opts.lastNDays || 14); // configurable recent-days window (default 14)
  const todayKey = new Date().toISOString().slice(0, 10);

  const todayActivities = useMemo(() => activities.filter(a => a.start_time && a.start_time.startsWith(todayKey)), [activities, todayKey]);
  const todaySteps = useMemo(() => sum(todayActivities, pickSteps), [todayActivities]);
  const todayDistance = useMemo(() => sum(todayActivities, a => a.distance_km), [todayActivities]);
  const todayCalories = useMemo(() => sum(todayActivities, a => a.calories), [todayActivities]);

  const weekCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  }, []);

  const weeklyActivities = useMemo(() => activities.filter(a => {
    if (!a.start_time) return false;
    const dt = new Date(a.start_time);
    return dt >= weekCutoff;
  }), [activities, weekCutoff]);

  const weeklyStepsRaw = useMemo(() => sum(weeklyActivities, pickSteps), [weeklyActivities]);
  const weeklyDistance = useMemo(() => sum(weeklyActivities, a => a.distance_km), [weeklyActivities]);
  const activeDays = useMemo(() => {
    const days = new Set();
    weeklyActivities.forEach(a => { if (a.start_time) days.add(a.start_time.slice(0,10)); });
    return days.size;
  }, [weeklyActivities]);

  // Build a map date -> aggregated metrics for sparkline (last N days)
  const lastNDaysSeries = useMemo(() => {
    const now = new Date();
    const map = new Map();
    for (let i = lastNDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0,10);
      map.set(key, { distance: 0, steps: 0, calories: 0 });
    }
    activities.forEach(a => {
      if (!a.start_time) return;
      const key = a.start_time.slice(0,10);
      if (map.has(key)) {
        const rec = map.get(key);
        rec.distance += Number(a.distance_km) || 0;
        let s = pickSteps(a);
        if (s == null) s = findNumericFieldByPattern(a, ['step','steps','step_count','total_steps','daily_steps','stepCount','totalSteps']);
        if (s != null) rec.steps += s;
        rec.calories += Number(a.calories) || 0;
      }
    });
    return Array.from(map.entries()).map(([date, vals]) => ({ date, ...vals }));
  }, [activities, lastNDays]);

  // Fallback: if raw weekly steps is zero but we have data points in the last 7 days of the recent series, derive from that
  const weeklySteps = useMemo(() => {
    if (weeklyStepsRaw > 0) return weeklyStepsRaw;
    const last7 = lastNDaysSeries.slice(-7);
    const derived = last7.reduce((acc, d) => acc + (d.steps || 0), 0);
    return derived;
  }, [weeklyStepsRaw, lastNDaysSeries]);

  // Weekly grouping (last 8 weeks) for summary / average pace
  const weeklyGroups = useMemo(() => {
    // weekKey -> aggregate record including daily distance map
    const map = new Map(); // key => { distance, steps, calories, durationMin, daily: Map<dateStr, {distance}> }
    activities.forEach(a => {
      if (!a.start_time) return;
      const dt = new Date(a.start_time);
      // ISO week key calculation
      const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const dayNum = (tmp.getUTCDay() + 6) % 7; // 0=Mon
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thursday anchor
      const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
      const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
      const year = tmp.getUTCFullYear();
      const key = `${year}-W${String(week).padStart(2,'0')}`;
      if (!map.has(key)) map.set(key, { distance:0, steps:null, calories:0, durationMin:0, daily:new Map(), hrWeighted:0, hrDuration:0, trainingLoad:null, trainingEffectVals:[], anaerobicEffectVals:[], paceSum:0, paceCount:0 });
        const rec = map.get(key);
  const dist = Number(a.distance_km) || 0;
  rec.distance += dist;
        let s = pickSteps(a);
        if (s == null) {
          // fallback: scan for any field name that looks like steps
          s = findNumericFieldByPattern(a, ['step','steps','step_count','total_steps','daily_steps']);
        }
        if (s != null) rec.steps = (rec.steps || 0) + s;
      rec.calories += Number(a.calories) || 0;
  // Normalize duration into minutes using helper
      const durMin = durationToMinutes(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time);
      rec.durationMin += (durMin != null ? durMin : 0);
  // Prefer pace reported by source if available (avg_pace). Support other legacy names as fallback.
  const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min;
      const parsedPace = parsePaceToMinutes(rawPace);
      if (parsedPace != null && Number.isFinite(parsedPace)) {
        rec.paceSum += parsedPace;
        rec.paceCount += 1;
      }
      if (a.avg_hr && a.duration_min) {
        rec.hrWeighted += Number(a.avg_hr) * Number(a.duration_min);
        rec.hrDuration += Number(a.duration_min);
      }
        // Support both snake_case and camelCase training load field names
        let tl = pickTrainingLoad(a);
        if (tl == null) {
          // fallback: common training load field name patterns
    tl = findNumericFieldByPattern(a, ['training[_A-Za-z]*load','\\btl\\b','load[_A-Za-z]*score','load[_A-Za-z]*value','acute_load','chronic_load','loadscore','training_load','work[_A-Za-z]*load','workload','trimp','session[_A-Za-z]*load','loadscore','work[_A-Za-z]*load']);
        }
        if (tl != null) rec.trainingLoad = (rec.trainingLoad || 0) + tl;
      if (a.training_effect) rec.trainingEffectVals.push(Number(a.training_effect));
      if (a.anaerobic_training_effect) rec.anaerobicEffectVals.push(Number(a.anaerobic_training_effect));
      // daily distance accumulation and mark if day has pace
      const dateKey = a.start_time.slice(0,10);
      if (!rec.daily.has(dateKey)) rec.daily.set(dateKey, { distance:0, hasPace: false });
      const dayRec = rec.daily.get(dateKey);
      dayRec.distance += dist;
      // mark that this day has a pace if source provided it or duration+distance allow computing it
      const computedPace = parsedPace != null ? parsedPace : (durMin != null && dist > 0 ? (durMin / dist) : null);
      if (computedPace != null) dayRec.hasPace = true;
    });
    // Sort by week descending, take last up to 52 (1 year), then chronological
    const arr = Array.from(map.entries()).sort((a,b) => a[0] < b[0] ? 1 : -1).slice(0,52).reverse();
    const chronological = arr.map(([week, vals]) => {
      // Build ordered 7-day array (Mon-Sun) of distances; find Monday of that ISO week
      const [yearStr, weekPart] = week.split('-W');
      const year = Number(yearStr);
      const weekNum = Number(weekPart);
      // Based on ISO: Thursday of week
      const fourthJan = new Date(Date.UTC(year,0,4));
      const fourthJanDayNum = (fourthJan.getUTCDay() + 6) % 7;
      const week1Thursday = new Date(fourthJan);
      week1Thursday.setUTCDate(fourthJan.getUTCDate() - fourthJanDayNum + 3);
      const targetThursday = new Date(week1Thursday);
      targetThursday.setUTCDate(week1Thursday.getUTCDate() + (weekNum -1)*7);
      // Monday of target week
      const monday = new Date(targetThursday);
      monday.setUTCDate(targetThursday.getUTCDate() - 3);
      const dailyDistanceSeries = [];
      for (let i=0;i<7;i++) {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate()+i);
        const key = d.toISOString().slice(0,10);
        const day = vals.daily.get(key);
        dailyDistanceSeries.push(day ? day.distance : 0);
      }
      const avgHr = vals.hrDuration ? (vals.hrWeighted / vals.hrDuration) : null;
      const trainingEffect = vals.trainingEffectVals.length ? (vals.trainingEffectVals.reduce((a,b)=>a+b,0)/vals.trainingEffectVals.length) : null;
      const anaerobicEffect = vals.anaerobicEffectVals.length ? (vals.anaerobicEffectVals.reduce((a,b)=>a+b,0)/vals.anaerobicEffectVals.length) : null;
      // count active days based on presence of pace data for the day
      const activeDaysCount = (() => {
        let c = 0;
        for (const v of vals.daily.values()) {
          if (v && v.hasPace) c += 1;
        }
        return c;
      })();
  const avgPace = vals.distance ? (vals.durationMin / vals.distance) : null;
  // If source provided per-activity paces, prefer their average for the week's avgPace
  const avgPaceFromSource = vals.paceCount ? (vals.paceSum / vals.paceCount) : null;
  const finalAvgPace = avgPaceFromSource != null ? avgPaceFromSource : avgPace;
  return { week, distance: vals.distance, steps: vals.steps, calories: vals.calories, durationMin: vals.durationMin, avgPace: finalAvgPace, dailyDistanceSeries, avgHr, trainingLoad: vals.trainingLoad, trainingEffect, anaerobicEffect, activeDaysCount };
    });
    // Compute streak of consecutive weeks that have avgPace available (preferred)
    let streak = 0;
    chronological.forEach(w => {
      if (w.avgPace != null) {
        streak += 1;
      } else {
        streak = 0;
      }
      w.streakUp = streak;
    });

    // Rolling 4-week average pace (lower is better). Pace = minutes per km (avgPace already in minutes per km)
    // For each week compute rollingAvgPace4 (including current) over last up to 4 weeks with non-null avgPace.
    // Improvement (paceImprovementPct): (previousRolling - currentRolling)/previousRolling * 100 (positive means faster)
    chronological.forEach((w, idx) => {
      const window = [];
      for (let i = Math.max(0, idx - 3); i <= idx; i++) {
        const candidate = chronological[i];
        if (candidate.avgPace != null && !Number.isNaN(candidate.avgPace)) window.push(candidate.avgPace);
      }
      w.rollingAvgPace4 = window.length ? (window.reduce((a,b)=>a+b,0) / window.length) : null;
      if (idx > 0) {
        // previous rolling window not including current week => compute as window over previous idx-1
        const prevWindow = [];
        for (let i = Math.max(0, idx - 4); i <= idx -1; i++) {
          const candidate = chronological[i];
          if (candidate.avgPace != null && !Number.isNaN(candidate.avgPace)) prevWindow.push(candidate.avgPace);
        }
        const prevAvg = prevWindow.length ? (prevWindow.reduce((a,b)=>a+b,0)/prevWindow.length) : null;
        if (prevAvg && w.rollingAvgPace4) {
          w.paceImprovementPct = ((prevAvg - w.rollingAvgPace4) / prevAvg) * 100; // positive => faster
        } else {
          w.paceImprovementPct = null;
        }
      } else {
        w.paceImprovementPct = null;
      }
    });
    return chronological;
  }, [activities]);

  return {
    todayKey,
    todayActivities,
    todaySteps,
    todayDistance,
    todayCalories,
    weeklyActivities,
    weeklySteps,
    weeklyDistance,
    activeDays,
    // expose the series with a neutral name; callers can request different window via opts
    lastNDaysSeries,
    weeklyGroups,
    pickSteps
  };
};

export default useActivityAggregates;
