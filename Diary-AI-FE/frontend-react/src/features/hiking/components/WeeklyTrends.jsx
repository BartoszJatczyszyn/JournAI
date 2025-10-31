import React, { useMemo } from 'react';
import WeeklyTrends from 'shared/widgets/WeeklyTrends';
import { useActivityAggregates } from 'hooks';
import { formatDuration, formatPaceMinPerKm } from 'utils/timeUtils';
import Sparkline from '../../../components/Sparkline';
import { useHealthData } from 'app/providers/HealthDataProvider';

export default function WeeklyTrendsHiking({ activities: incomingActivities } = {}) {
  const activities = useMemo(() => (Array.isArray(incomingActivities) ? incomingActivities : []), [incomingActivities]);
  const { isSportMatch } = require('shared/lib/activityUtils');
  const sportActivities = useMemo(
    () => (Array.isArray(activities) ? activities : []).filter(a => isSportMatch(a, 'hiking')),
    [activities, isSportMatch]
  );
  const { weeklyGroups = [] } = useActivityAggregates(sportActivities) || {};
  const { dashboardData, fetchDashboardForDays, fetchDashboardForRange } = useHealthData();

  React.useEffect(() => {
    try {
      if (!Array.isArray(sportActivities) || sportActivities.length === 0) return;
      const times = sportActivities.map(a => (a?.start_time ? new Date(a.start_time) : null)).filter(d => d && !Number.isNaN(d.getTime())).map(d => d.getTime());
      if (times.length === 0) return;
      const minTs = Math.min(...times);
      const maxTs = Math.max(...times);
      const msPerDay = 24*60*60*1000;
      const spanDays = Math.max(1, Math.ceil((maxTs - minTs + msPerDay) / msPerDay));

      const rows = (dashboardData?.windowData) || [];
      const rTimes = rows.map(r => r?._dayObj?.getTime?.()).filter(t => Number.isFinite(t));
      const hasCoverage = (() => {
        if (rTimes.length === 0) return false;
        const rMin = Math.min(...rTimes);
        const rMax = Math.max(...rTimes);
        const tol = 2 * msPerDay;
        return (rMin <= (minTs + tol)) && (rMax >= (maxTs - tol));
      })();
      if (!hasCoverage) {
        // Prefer explicit historical range fetch to guarantee coverage for older hikes
        const startStr = new Date(minTs).toISOString().slice(0,10);
        const endStr = new Date(maxTs).toISOString().slice(0,10);
        if (fetchDashboardForRange) {
          fetchDashboardForRange(startStr, endStr);
        } else {
          // Fallback: expand days window anchored to today (may not cover historical spans)
          const reqDays = Math.min(400, Math.max(30, spanDays + 7));
          fetchDashboardForDays?.(reqDays);
        }
      }
    } catch (e) {
      // silent guard
    }
  }, [sportActivities, dashboardData, fetchDashboardForDays, fetchDashboardForRange]);

  const weeklyGroupsFilled = useMemo(() => {
    try {
      const rowsRaw = (dashboardData?.windowData) || (dashboardData?.healthData?.all) || [];
      let minTs = Infinity, maxTs = -Infinity;
      sportActivities.forEach(a => {
        if (!a?.start_time) return;
        const t = new Date(a.start_time).getTime();
        if (Number.isNaN(t)) return;
        if (t < minTs) minTs = t;
        if (t > maxTs) maxTs = t;
      });
      const rows = rowsRaw.filter(r => {
        const t = r?._dayObj?.getTime?.();
        return Number.isFinite(t) && t >= minTs && t <= maxTs;
      });
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
      rows.forEach(r => {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
        if (!d || isNaN(d.getTime())) return;
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
  }, [weeklyGroups, dashboardData, sportActivities]);

  const rows = useMemo(() => (weeklyGroupsFilled || weeklyGroups).map((w, i, arr) => {
    const prev = i > 0 ? arr[i-1] : null;
    const dist = Number(w.distance || 0);
    const prevDist = Number(prev?.distance || 0);
    const diff = prev ? (dist - prevDist) : null;
    const pct = prev && prevDist > 0 ? ((dist - prevDist) / prevDist) * 100 : null;
    const trend = !prev ? '.' : diff > 0 ? '↑' : diff < 0 ? '↓' : '·';
    // Derive steps for hiking when missing using cadence or step length if available
    const { derivedSteps, derivedBy } = (() => {
      try {
        if (w?.avgStepsPerMin && w?.durationMin) {
          const s = Number(w.avgStepsPerMin) * Number(w.durationMin);
          return Number.isFinite(s) ? { derivedSteps: Math.round(s), derivedBy: 'cadence' } : { derivedSteps: null, derivedBy: null };
        }
        if (w?.avgStepLengthM && dist > 0) {
          const s = (dist * 1000) / Number(w.avgStepLengthM);
          return Number.isFinite(s) ? { derivedSteps: Math.round(s), derivedBy: 'step_length' } : { derivedSteps: null, derivedBy: null };
        }
      } catch (_) { /* ignore */ }
      return { derivedSteps: null, derivedBy: null };
    })();
    return {
      week: w.week,
      trend,
      streakUp: w.streakUp ?? 0,
      distanceChange: pct,
      distance: dist,
      steps: typeof w.steps === 'number' ? w.steps : (derivedSteps ?? null),
      stepsSource: (typeof w.steps === 'number') ? 'measured' : (derivedSteps != null ? 'derived' : null),
      stepsDerivedBy: derivedBy,
      calories: typeof w.calories === 'number' ? w.calories : null,
      durationMin: typeof w.durationMin === 'number' ? w.durationMin : null,
      avgPace: w.avgPace ?? null,
      rollingAvgPace4: w.rollingAvgPace4 ?? null,
      paceImprovementPct: w.paceImprovementPct ?? null,
      avgHr: w.avgHr ?? null,
      trainingLoad: w.trainingLoad ?? null,
      trainingLoadSource: w.trainingLoadSource ?? null,
      trainingEffect: w.trainingEffect ?? null,
      anaerobicEffect: w.anaerobicEffect ?? null,
      activeDaysCount: w.activeDaysCount ?? 0,
      dailyDistanceSeries: Array.isArray(w.dailyDistanceSeries) ? w.dailyDistanceSeries : [],
      elevationGainM: w.elevationGainM ?? 0,
    };
  }), [weeklyGroupsFilled, weeklyGroups]);

  const columns = [
    { key: 'trend', label: 'Trend', format: v => <span className={v==='↑'?'text-green-600':v==='↓'?'text-red-600':'text-gray-500'}>{v || '·'}</span>, tooltip: () => 'Direction of change vs previous week' },
    { key: 'streakUp', label: 'Streak↑', tooltip: (v)=> v!=null?`Weeks with data in a row: ${v}`:null },
    { key: 'distanceChange', label: 'Change %', format: v => v==null?'—':`${v>0?'+':''}${v.toFixed(1)}%`, tooltip: (v)=> v!=null?`Distance change vs previous week: ${v>0?'+':''}${v.toFixed(1)}%`:null },
    { key: 'distance', label: 'Distance (km)', format: v => Number(v||0).toFixed(2), tooltip: (v,r,prev)=> (prev && prev.distance!=null)?`This week: ${Number(v||0).toFixed(2)} km; Last: ${Number(prev.distance||0).toFixed(2)} km`:null },
    { key: 'steps', label: 'Steps', format: (v,r) => {
      if (typeof v === 'number') {
        const marker = r.stepsSource === 'derived' ? '*' : '';
        const title = r.stepsSource === 'derived'
          ? (r.stepsDerivedBy === 'cadence' ? 'Derived: steps/min × duration' : r.stepsDerivedBy === 'step_length' ? 'Derived: distance ÷ step length' : 'Derived value')
          : 'Measured';
        return <span title={title}>{v.toLocaleString()}{marker}</span>;
      }
      return '-';
    }, tooltip: (v,r,prev)=> (typeof v==='number' && prev)?`This week: ${v.toLocaleString()} steps; Last: ${typeof prev.steps==='number'?prev.steps.toLocaleString():'—'}`:null },
    { key: 'elevationGainM', label: 'Elev Gain (m)', format: v => Number(v||0).toFixed(0) },
    { key: 'calories', label: 'Calories', format: v => typeof v==='number'? v.toLocaleString():'-' },
    { key: 'durationMin', label: 'Duration (min)', format: v => typeof v==='number'? formatDuration(v,'minutes'):'-' },
    { key: 'avgPace', label: 'Avg Pace', format: v => v!=null? formatPaceMinPerKm(v):'-' },
    { key: 'rollingAvgPace4', label: 'Rolling Pace (4w)', format: v => v!=null? formatPaceMinPerKm(v):'-' },
    { key: 'paceImprovementPct', label: 'Pace Δ%', format: v => v!=null?(<span className={v>0?'text-green-600':v<0?'text-red-600':'text-gray-500'}>{`${v>0?'+':''}${v.toFixed(1)}%`}</span>):'—', tooltip: (v)=> v!=null?`Rolling 4w pace improvement: ${v>0?'+':''}${v.toFixed(1)}%`:null },
    { key: 'avgHr', label: 'Avg HR', format: v => v!=null? Number(v).toFixed(0):'-' },
    { key: 'trainingLoad', label: 'Training Load', format: (v,r)=> (typeof v==='number'? (<span className={r.trainingLoadSource==='derived'?'text-indigo-600 dark:text-indigo-400':''} title={r.trainingLoadSource==='derived'?'Derived from training_effect × duration (approximate)':'Explicit training load value'}>{Number(v).toFixed(0)}{r.trainingLoadSource==='derived'?'*':''}</span>):'-'), tooltip: (v,r,prev)=> (v!=null && prev && prev.trainingLoad!=null)?`This week: ${Number(v).toFixed(0)}; Last: ${Number(prev.trainingLoad).toFixed(0)}`:null },
    { key: 'effects', label: 'Effects (Aer/Ana)', format: (_v,r)=> `${r.trainingEffect!=null?r.trainingEffect.toFixed(1):'-'} / ${r.anaerobicEffect!=null?r.anaerobicEffect.toFixed(1):'-'}` },
    { key: 'activeDaysCount', label: 'Consistency', format: v => (<span className={v>=7?'text-green-600 font-semibold':v>=5?'text-indigo-600':v>=3?'text-yellow-600':'text-red-600'}>{v} / 7</span>), tooltip: (v)=> v!=null?`Active days this week: ${v} / 7`:null },
    { key: 'mini', label: 'Mini Dist', format: (_v,r)=> (
      <div className="w-32">
        <Sparkline data={(r.dailyDistanceSeries||[]).map(v=>({value:v}))} height={26} stroke="#0ea5e9" fill="rgba(14,165,233,0.15)" tooltipFormatter={(pt,di)=>`Day ${di+1}: ${Number(pt.value||0).toFixed(2)} km`} />
      </div>
    ), tooltip: () => 'Daily distances this week' },
  ];

  return <WeeklyTrends title="Hiking Weekly" rows={rows} columns={columns} defaultSortKey="week" defaultSortDir="desc" />;
}
