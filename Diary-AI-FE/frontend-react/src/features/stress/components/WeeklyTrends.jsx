import React, { useMemo } from 'react';
import WeeklyTrends from 'shared/widgets/WeeklyTrends';
import { useHealthData } from 'app/providers/HealthDataProvider';
import { healthAPI } from 'features/health/api';
import Sparkline from '../../../components/Sparkline';

export default function WeeklyTrendsStress({ pageSize } = {}){
  const { dashboardData, fetchDashboardForDays } = useHealthData();
  const [analysisWeeklyMap, setAnalysisWeeklyMap] = React.useState(null);

  // Ensure wider coverage for stable weekly trends
  React.useEffect(() => {
    try {
      const rows = dashboardData?.windowData || [];
      if (!Array.isArray(rows) || rows.length < 60) {
        fetchDashboardForDays?.(180);
      }
    } catch (e) { /* ignore */ }
  }, [dashboardData, fetchDashboardForDays]);

  // Load backend stress analysis for more accurate high-stress day counts (optional, best-effort)
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dto = await healthAPI.getStressAnalysis?.(180);
        const list = Array.isArray(dto?.weekly) ? dto.weekly : [];
        const m = new Map();
        list.forEach(w => {
          const key = w?.week;
          const val = w?.high_stress_days;
          if (key) m.set(String(key), (val != null ? Number(val) : null));
        });
        if (active) setAnalysisWeeklyMap(m);
      } catch (e) {
        if (active) setAnalysisWeeklyMap(new Map());
      }
    })();
    return () => { active = false; };
  }, []);

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
      const HIGH_STRESS_AVG_THRESHOLD = 60; // heuristic for daily average stress
      const HIGH_STRESS_PEAK_THRESHOLD = 75; // heuristic for peak stress
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
        if (!map.has(key)) map.set(key, { week: key, stressSum: 0, stressCnt: 0, highDays: 0, days: 0, dailyStress: [] });
        const rec = map.get(key);
        const stress = getNum(r, ['stress_avg','stress','avg_stress'], ['stress']);
        const episodes = getNum(r, ['high_stress_episodes','total_high_stress_episodes']);
        const peak = getNum(r, ['peak_stress_value','max_stress','max_daily_stress']);
        if (stress != null) { rec.stressSum += stress; rec.stressCnt += 1; rec.dailyStress.push(stress); }
        // Mark a high-stress day if:
        // - explicit episodes count > 0, OR
        // - peak stress >= 75, OR
        // - daily avg stress >= 60 (fallback)
        const isHigh = (episodes != null && episodes > 0)
          || (peak != null && peak >= HIGH_STRESS_PEAK_THRESHOLD)
          || (stress != null && stress >= HIGH_STRESS_AVG_THRESHOLD);
        if (isHigh) rec.highDays += 1;
        rec.days += 1;
      });
      const arr = Array.from(map.values()).sort((a,b)=> a.week < b.week ? -1 : 1).map(v => ({
        week: v.week,
        avgStress: v.stressCnt ? (v.stressSum / v.stressCnt) : null,
        highStressDays: v.highDays,
        daysWithData: v.days,
        dailyStressSeries: v.dailyStress,
      }));

      // Prefer backend analysis if available for high_stress_days (more accurate per-episode detection)
      if (analysisWeeklyMap && analysisWeeklyMap.size) {
        arr.forEach(w => {
          if (analysisWeeklyMap.has(w.week)) {
            const val = analysisWeeklyMap.get(w.week);
            if (val != null) w.highStressDays = val;
          }
        });
      }

      // trend/streak on stress (lower is better, but we simply show change sign)
      let streak = 0;
      arr.forEach((w, i) => {
        const prev = i>0 ? arr[i-1] : null;
        const cur = w.avgStress;
        const trend = (!prev || prev.avgStress == null || cur == null) ? '.' : (cur > prev.avgStress ? '↑' : cur < prev.avgStress ? '↓' : '·');
        w.trend = trend;
        if (cur != null) streak += 1; else streak = 0;
        w.streakUp = streak;
        w.changePct = (prev && prev.avgStress != null && cur != null && prev.avgStress !== 0)
          ? ((cur - prev.avgStress) / prev.avgStress) * 100
          : null;
      });

      // rolling 4w stress
      arr.forEach((w, idx) => {
        const window = [];
        for (let i = Math.max(0, idx - 3); i <= idx; i++) {
          const v = arr[i].avgStress;
          if (v != null && !Number.isNaN(v)) window.push(v);
        }
        w.rollingAvgStress4 = window.length ? (window.reduce((s,v)=>s+v,0)/window.length) : null;
        if (idx > 0) {
          const prevWindow = [];
          for (let i = Math.max(0, idx - 4); i <= idx - 1; i++) {
            const v = arr[i].avgStress;
            if (v != null && !Number.isNaN(v)) prevWindow.push(v);
          }
          const prevAvg = prevWindow.length ? (prevWindow.reduce((s,v)=>s+v,0)/prevWindow.length) : null;
          w.stressImprovementPct = (prevAvg && w.rollingAvgStress4) ? ((prevAvg - w.rollingAvgStress4)/prevAvg)*100 : null; // positive = lower stress
        } else {
          w.stressImprovementPct = null;
        }
      });
      // Limit number of weeks displayed if pageSize provided
      const weeksToShow = Math.max(1, Number(pageSize || 0) || 0);
      return weeksToShow ? arr.slice(-weeksToShow) : arr;
    } catch { return []; }
  }, [dashboardData, analysisWeeklyMap, pageSize]);

  const rows = useMemo(() => weekly.map(w => ({
    week: w.week,
    trend: w.trend,
    streakUp: w.streakUp ?? 0,
    changePct: w.changePct ?? null,
    avgStress: w.avgStress ?? null,
    highStressDays: w.highStressDays ?? 0,
    rollingAvgStress4: w.rollingAvgStress4 ?? null,
    stressImprovementPct: w.stressImprovementPct ?? null,
    consistency: w.daysWithData ?? 0,
    dailyStressSeries: Array.isArray(w.dailyStressSeries) ? w.dailyStressSeries : [],
  })), [weekly]);

  const columns = [
    { key: 'trend', label: 'Trend', format: v => <span className={v==='↑'?'text-red-600':v==='↓'?'text-green-600':'text-gray-500'}>{v || '·'}</span>, tooltip: () => 'Direction of change vs previous week' },
    { key: 'streakUp', label: 'Streak↑', tooltip: (v)=> v!=null?`Weeks with data in a row: ${v}`:null },
    { key: 'changePct', label: 'Change %', format: v => v==null?'—':`${v>0?'+':''}${v.toFixed(1)}%`, tooltip: (v)=> v!=null?`Stress change vs previous week: ${v>0?'+':''}${v.toFixed(1)}%`:null },
    { key: 'avgStress', label: 'Avg Stress', format: v => v!=null ? Number(v).toFixed(1) : '—', tooltip: (v,r,prev)=> (v!=null && prev?.avgStress!=null)?`This week: ${v.toFixed(1)}; Last: ${prev.avgStress.toFixed(1)}`:null },
    { key: 'highStressDays', label: 'High Stress Days', tooltip: (v)=> v!=null?`${v} high-stress days this week`:null },
    { key: 'rollingAvgStress4', label: 'Rolling Stress (4w)', format: v => v!=null ? Number(v).toFixed(1) : '—' },
    { key: 'stressImprovementPct', label: 'Stress Δ% (↓=good)', format: v => v!=null ? (<span className={v>0?'text-green-600':v<0?'text-red-600':'text-gray-500'}>{`${v>0?'+':''}${v.toFixed(1)}%`}</span>) : '—', tooltip: (v)=> v!=null?`Rolling 4w stress improvement (down is good): ${v>0?'+':''}${v.toFixed(1)}%`:null },
    { key: 'consistency', label: 'Consistency', format: v => (<span className={v>=7?'text-green-600 font-semibold':v>=5?'text-indigo-600':v>=3?'text-yellow-600':'text-red-600'}>{v} / 7</span>), tooltip: (v)=> v!=null?`Days with data: ${v} / 7`:null },
    { key: 'mini', label: 'Mini Stress', format: (_v,r)=> (
      <div className="w-32">
        <Sparkline data={(r.dailyStressSeries||[]).map(v=>({value:v}))} height={26} stroke="#f59e0b" fill="rgba(245,158,11,0.15)" tooltipFormatter={(pt,di)=>`Day ${di+1}: ${Number(pt.value||0).toFixed(1)}`} />
      </div>
    ), tooltip: () => 'Daily stress this week' },
  ];

  return <WeeklyTrends title="Stress Weekly" rows={rows} columns={columns} defaultSortKey="week" defaultSortDir="desc" />;
}
