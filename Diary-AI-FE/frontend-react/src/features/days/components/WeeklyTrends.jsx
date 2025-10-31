import React, { useMemo } from 'react';
import WeeklyTrends from 'shared/widgets/WeeklyTrends';
import { useHealthData } from 'app/providers/HealthDataProvider';
import healthAPI from 'features/health/api';

export default function WeeklyTrendsDays({ days }){
  const { dashboardData, fetchDashboardForDays } = useHealthData();
  const [activityWeeklyMap, setActivityWeeklyMap] = React.useState(new Map());

  // Format seconds -> HH:MM:SS
  const fmtHMS = (seconds) => {
    const n = Number(seconds);
    if (seconds == null || Number.isNaN(n)) return '—';
    const s = Math.max(0, Math.round(n));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  // Ensure we have ample coverage for weekly trends (expand to ~180 days if the window is small)
  React.useEffect(() => {
    try {
      if (typeof days === 'number' && days > 0) {
        fetchDashboardForDays?.(days);
        return;
      }
      // Fallback behavior when no days prop provided: ensure enough coverage for weekly view
      const rows = dashboardData?.windowData || [];
      if (!Array.isArray(rows) || rows.length < 60) {
        fetchDashboardForDays?.(180);
      }
    } catch (e) { /* ignore */ }
  }, [days, dashboardData, fetchDashboardForDays]);

  // Fetch activity weekly aggregates to backfill distance when daily summaries don't expose distance fields
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = typeof days === 'number' && days > 0 ? days : 90;
        const res = await healthAPI.getActivityAnalysis(d);
        const wk = Array.isArray(res?.weekly) ? res.weekly : [];
        const map = new Map();
        wk.forEach(w => { if (w.week) map.set(String(w.week), Number(w.total_distance_km || w.distance || 0)); });
        if (!cancelled) setActivityWeeklyMap(map);
      } catch (e) {
        if (!cancelled) setActivityWeeklyMap(new Map());
      }
    };
    load();
    return () => { cancelled = true; };
  }, [days]);

  const weekly = useMemo(() => {
    try {
      const rows = dashboardData?.windowData || dashboardData?.healthData || [];
      const list = Array.isArray(rows) ? rows : [];
      const toDate = (r) => r?._dayObj || (r.day ? new Date(r.day) : (r.date ? new Date(r.date) : null));
      const getNum = (obj, keys, patterns = []) => {
        for (const k of keys) { if (obj[k] != null && !Number.isNaN(Number(obj[k]))) return Number(obj[k]); }
        if (patterns.length) {
          for (const key of Object.keys(obj)) {
            for (const p of patterns) { try { if (new RegExp(p,'i').test(key)) { const v = obj[key]; if (v != null && !Number.isNaN(Number(v))) return Number(v); } } catch { /* ignore */ } }
          }
        }
        return null;
      };
      const map = new Map();
      list.forEach(r => {
        const dt = toDate(r);
        if (!dt || Number.isNaN(dt.getTime())) return;
        const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7; tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
        const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
        const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
        const year = tmp.getUTCFullYear();
        const key = `${year}-W${String(week).padStart(2,'0')}`;

        if (!map.has(key)) map.set(key, {
          week: key,
          days: 0,
          // sums
          steps: 0,
          distanceMeters: 0,
          activeKcal: 0,
          totalKcal: 0,
          intensityMin: 0,
          modMin: 0,
          vigMin: 0,
          // avgs accumulators
          rhrSum: 0, rhrCnt: 0,
          hrAvgSum: 0, hrAvgCnt: 0,
          stressSum: 0, stressCnt: 0,
          spo2Sum: 0, spo2Cnt: 0,
          rrSum: 0, rrCnt: 0,
          bbMinSum: 0, bbMinCnt: 0,
          bbMaxSum: 0, bbMaxCnt: 0,
          // sleep-related accumulators
          sleepScoreSum: 0, sleepScoreCnt: 0,
          tibMinSum: 0, tibCnt: 0,
        });
        const rec = map.get(key);
        // sums
        const steps = getNum(r, ['steps','total_steps','daily_steps','steps_total']);
        if (steps != null) rec.steps += steps;
        // Distance normalization:
        // - Some datasets expose "distance_meters" actually in kilometers (misnamed). If value < 1000, treat as km and convert to meters.
        // - For activities_distance, apply the same heuristic.
        const distM = getNum(r, ['distance_meters']);
        const actDist = getNum(r, ['activities_distance']);
        if (distM != null) {
          rec.distanceMeters += (distM >= 1000 ? distM : distM * 1000);
        } else if (actDist != null) {
          rec.distanceMeters += (actDist >= 1000 ? actDist : actDist * 1000);
        }

  const activeCal = getNum(r, ['active_calories','activities_calories']);
  const totalCal = getNum(r, ['calories_burned','calories_total','calories']);
  // Prefer active calories; if missing, fall back to total calories so the column isn't empty
  if (activeCal != null) rec.activeKcal += activeCal;
        if (totalCal != null) rec.totalKcal += totalCal;
  if (activeCal == null && totalCal != null) rec.activeKcal += totalCal;
  // Intensity time: normalize to seconds with a safer heuristic.
  // Assumptions:
  // - Typical daily moderate/vigorous are in minutes (0..600). If <= 600, treat as minutes.
  // - If value is between 600 and 86400, assume it's already seconds.
  // - If value exceeds a day (> 86400), it's likely minutes misinterpreted as seconds; convert down by /60.
  const toSec = (x) => {
    const v = Number(x);
    if (x == null || Number.isNaN(v) || v <= 0) return 0;
    if (v <= 600) return v * 60;         // minutes → seconds (up to 10h)
    if (v <= 86400) return v;            // plausible seconds within a day
    return Math.round(v / 60);            // correct likely minutes mislabeled as seconds
  };
  const intensityRaw = getNum(r, ['intensity_time']);
  const modRaw = getNum(r, ['moderate_activity_time']);
  const vigRaw = getNum(r, ['vigorous_activity_time']);
  const modSec = toSec(modRaw);
  const vigSec = toSec(vigRaw);
  if (intensityRaw != null) rec.intensityMin += toSec(intensityRaw);
  else if (modRaw != null || vigRaw != null) rec.intensityMin += (modSec + vigSec);
  if (modRaw != null) rec.modMin += modSec;
  if (vigRaw != null) rec.vigMin += vigSec;

        // avgs
        const rhr = getNum(r, ['resting_heart_rate','rhr']);
        if (rhr != null) { rec.rhrSum += rhr; rec.rhrCnt += 1; }
  const hrAvg = getNum(r, ['hr_avg','avg_hr']);
        if (hrAvg != null) { rec.hrAvgSum += hrAvg; rec.hrAvgCnt += 1; }
        const stress = getNum(r, ['stress_avg']);
        if (stress != null) { rec.stressSum += stress; rec.stressCnt += 1; }
        const spo2 = getNum(r, ['spo2_avg']);
        if (spo2 != null) { rec.spo2Sum += spo2; rec.spo2Cnt += 1; }
  const rr = getNum(r, ['rr_waking_avg','rr_avg','avg_rr']);
        if (rr != null) { rec.rrSum += rr; rec.rrCnt += 1; }
        const bbMin = getNum(r, ['body_battery_min']);
        if (bbMin != null) { rec.bbMinSum += bbMin; rec.bbMinCnt += 1; }
        const bbMax = getNum(r, ['body_battery_max']);
        if (bbMax != null) { rec.bbMaxSum += bbMax; rec.bbMaxCnt += 1; }

    // Sleep metrics (count only > 0 to avoid skew from default zeros)
    const sleepScore = getNum(r, ['sleep_score']);
    if (sleepScore != null && sleepScore > 0) { rec.sleepScoreSum += sleepScore; rec.sleepScoreCnt += 1; }
    const tib = getNum(r, ['time_in_bed_minutes']);
    if (tib != null && tib > 0) { rec.tibMinSum += tib; rec.tibCnt += 1; }

        rec.days += 1;
      });

      let arr = Array.from(map.values())
        .sort((a,b)=> a.week < b.week ? -1 : 1)
        .map(v => ({
          week: v.week,
          daysWithData: v.days,
          totalSteps: v.steps || 0,
          totalDistanceKm: (v.distanceMeters || 0) / 1000,
          activeKcal: v.activeKcal || 0,
          totalKcal: v.totalKcal || 0,
          intensityMin: v.intensityMin || 0,
          modMin: v.modMin || 0,
          vigMin: v.vigMin || 0,
          avgRHR: v.rhrCnt ? (v.rhrSum / v.rhrCnt) : null,
          avgHR: v.hrAvgCnt ? (v.hrAvgSum / v.hrAvgCnt) : null,
          avgStress: v.stressCnt ? (v.stressSum / v.stressCnt) : null,
          avgSpO2: v.spo2Cnt ? (v.spo2Sum / v.spo2Cnt) : null,
          avgRR: v.rrCnt ? (v.rrSum / v.rrCnt) : null,
          avgBbMin: v.bbMinCnt ? (v.bbMinSum / v.bbMinCnt) : null,
          avgBbMax: v.bbMaxCnt ? (v.bbMaxSum / v.bbMaxCnt) : null,
          avgSleepScore: v.sleepScoreCnt ? (v.sleepScoreSum / v.sleepScoreCnt) : null,
          avgTimeInBedHours: v.tibCnt ? ((v.tibMinSum / v.tibCnt) / 60) : null,
        }));

      // Backfill distance using activity weekly totals, prefer the larger value to avoid undercounting
      arr = arr.map(row => {
        const wk = String(row.week);
        const alt = activityWeeklyMap.get(wk);
        if (typeof alt === 'number' && alt > 0) {
          const cur = Number(row.totalDistanceKm || 0);
          const best = cur <= 0 ? alt : Math.max(cur, alt);
          return { ...row, totalDistanceKm: best };
        }
        return row;
      });

      // simple WoW change on steps for quick glance
      arr.forEach((w, i) => {
        const prev = i>0 ? arr[i-1] : null;
        const cur = w.totalSteps;
        w.stepsChangePct = (prev && prev.totalSteps) ? ((cur - prev.totalSteps) / Math.max(1, prev.totalSteps)) * 100 : null;
      });
      return arr;
    } catch { return []; }
  }, [dashboardData, activityWeeklyMap]);

  const rows = useMemo(() => weekly.map(w => ({
    week: w.week,
    consistency: w.daysWithData ?? 0,
    totalSteps: w.totalSteps,
    totalDistanceKm: w.totalDistanceKm,
    avgDistanceKmPerDay: (w.daysWithData && w.daysWithData > 0) ? (Number(w.totalDistanceKm || 0) / w.daysWithData) : null,
    activeKcal: w.activeKcal,
    totalKcal: w.totalKcal,
    intensityMin: w.intensityMin,
    modMin: w.modMin,
    vigMin: w.vigMin,
    avgRHR: w.avgRHR,
    avgHR: w.avgHR,
    avgStress: w.avgStress,
    avgSpO2: w.avgSpO2,
    avgRR: w.avgRR,
    avgBbMin: w.avgBbMin,
    avgBbMax: w.avgBbMax,
    avgSleepScore: w.avgSleepScore,
    avgTimeInBedHours: w.avgTimeInBedHours,
    stepsChangePct: w.stepsChangePct,
  })), [weekly]);

  const columns = [
    { key: 'consistency', label: 'Days', format: v => (<span className={v>=7?'text-green-600 font-semibold':v>=5?'text-indigo-600':v>=3?'text-yellow-600':'text-red-600'}>{v} / 7</span>), tooltip: (v)=> v!=null?`Days with data: ${v} / 7`:null },
    { key: 'totalSteps', label: 'Steps (Σ)', format: v => v==null?'—':Number(v).toLocaleString(), tooltip: (v,r,prev)=> (v!=null && prev?.totalSteps!=null)?`This week: ${Number(v).toLocaleString()} steps; Last: ${Number(prev.totalSteps).toLocaleString()} steps`:null },
    { key: 'totalDistanceKm', label: 'Distance (km)', format: v => v==null?'—':Number(v).toFixed(2), tooltip: (v,r,prev)=> (v!=null && prev?.totalDistanceKm!=null)?`This week: ${Number(v).toFixed(2)} km; Last: ${Number(prev.totalDistanceKm).toFixed(2)} km`:null },
    { key: 'avgDistanceKmPerDay', label: 'Dist/day (avg km)', format: v => v==null?'—':Number(v).toFixed(2) },
  { key: 'activeKcal', label: 'Active kcal (Σ)', format: v => v==null?'—':Number(v).toFixed(0) },
    { key: 'totalKcal', label: 'Total kcal (Σ)', format: v => v==null?'—':Number(v).toFixed(0) },
  { key: 'intensityMin', label: 'Intensity (Σ)', format: v => fmtHMS(Number(v)) },
  { key: 'modMin', label: 'Moderate', format: v => fmtHMS(Number(v)) },
  { key: 'vigMin', label: 'Vigorous', format: v => fmtHMS(Number(v)) },
    { key: 'avgRHR', label: 'RHR (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgHR', label: 'HR (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgStress', label: 'Stress (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgSpO2', label: 'SpO2 % (avg)', format: v => v!=null ? Number(v).toFixed(1) : '—' },
    { key: 'avgRR', label: 'RR (avg)', format: v => v!=null ? Number(v).toFixed(1) : '—' },
    { key: 'avgBbMin', label: 'BodyBatt min (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgBbMax', label: 'BodyBatt max (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgSleepScore', label: 'Sleep score (avg)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgTimeInBedHours', label: 'Time in bed (avg)', format: v => fmtHMS(Number(v) * 3600) },
    { key: 'stepsChangePct', label: 'Steps Δ% WoW', format: v => v==null?'—':(<span className={v>0?'text-green-600':v<0?'text-red-600':'text-gray-500'}>{`${v>0?'+':''}${v.toFixed(1)}%`}</span>) },
  ];

  return <WeeklyTrends title="Daily Metrics Weekly" rows={rows} columns={columns} defaultSortKey="week" defaultSortDir="desc" />;
}
