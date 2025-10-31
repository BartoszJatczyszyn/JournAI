import React, { useMemo } from 'react';
import WeeklyTrends from 'shared/widgets/WeeklyTrends';
import { sleepsAPI } from 'features/sleep/api';
import Sparkline from '../../../components/Sparkline';
// Use local helpers to show hours:minutes (H:MM) without seconds

export default function WeeklyTrendsSleep({ pageSize } = {}){
  const [daily, setDaily] = React.useState([]);

  // Helpers to format durations cleanly as H:MM (no seconds)
  const formatMinutesToHM = (mins) => {
    if (mins == null || isNaN(mins)) return '—';
    const total = Math.max(0, Math.round(Number(mins)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2,'0')}`;
  };
  const formatHoursToHM = (hours) => {
    if (hours == null || isNaN(hours)) return '—';
    const mins = Math.round(Number(hours) * 60);
    return formatMinutesToHM(mins);
  };

  React.useEffect(() => {
    (async () => {
      try{
        // Determine how many items to fetch based on desired weeks to show.
        // If pageSize provided, fetch at least weeks*7 items. Clamp to avoid extreme loads.
        const weeksToShow = Math.max(1, Number(pageSize || 0) || 0);
        const safeWeeks = weeksToShow ? Math.min(weeksToShow, 52) : 0; // cap at 1 year of weeks
        const fetchLimit = safeWeeks > 0 ? Math.max(safeWeeks * 7, 28) : 180; // default ~6 months if not specified

        const list = await sleepsAPI.getSleepTimeseries?.({ limit: fetchLimit });
        setDaily(Array.isArray(list) ? list : []);
      }catch(e){ setDaily([]); }
    })();
  },[pageSize]);

  // Build weekly aggregates similar to Activity tables (ISO week, trend, streak, rolling 4w)
  const weekly = useMemo(() => {
    try {
      if (!Array.isArray(daily) || daily.length === 0) return [];
      const toDate = (d) => { try { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? null : dt; } catch { return null; } };
      const map = new Map();
      daily.forEach(s => {
        const dt = toDate(s.day || s.date);
        if (!dt) return;
        const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7; // 0=Mon
        tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
        const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
        const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
        const year = tmp.getUTCFullYear();
        const key = `${year}-W${String(week).padStart(2,'0')}`;
        if (!map.has(key)) map.set(key, {
          week: key,
          scoreSum: 0, scoreCnt: 0,
          durSumMin: 0, durSumSec: 0,
          nights: 0,
          dailyDur: [],
          deepSecSum: 0,
          remSecSum: 0,
          awakeSecSum: 0,
          hrSum: 0, hrCnt: 0,
          respSum: 0, respCnt: 0,
          spo2Sum: 0, spo2Cnt: 0,
          spo2Lowest: null,
          napsSecSum: 0,
        });
        const rec = map.get(key);
        const score = s.sleep_score ?? s.score ?? null;
        if (score != null && !Number.isNaN(Number(score))) { rec.scoreSum += Number(score); rec.scoreCnt += 1; }
        const durMin = s.durationMinutes ?? s.duration_min ?? (s.sleep_duration_seconds ? s.sleep_duration_seconds/60 : null);
        const durSec = s.sleep_duration_seconds != null ? Number(s.sleep_duration_seconds) : (durMin != null ? Number(durMin) * 60 : null);
        if (durMin != null && !Number.isNaN(Number(durMin))) { rec.durSumMin += Number(durMin); rec.nights += 1; rec.dailyDur.push(Number(durMin)/60); }
        if (durSec != null && !Number.isNaN(durSec)) { rec.durSumSec += durSec; }

        // Stage sums (seconds)
        const deepSec = Number(s.deep_sleep_seconds ?? NaN); if (!Number.isNaN(deepSec)) rec.deepSecSum += deepSec;
        const remSec = Number(s.rem_sleep_seconds ?? NaN); if (!Number.isNaN(remSec)) rec.remSecSum += remSec;
        const awakeSec = Number(s.awake_seconds ?? NaN); if (!Number.isNaN(awakeSec)) rec.awakeSecSum += awakeSec;

        // HR / Respiration
        const hr = Number(s.avg_sleep_hr ?? NaN); if (!Number.isNaN(hr)) { rec.hrSum += hr; rec.hrCnt += 1; }
        const resp = Number(s.avg_respiration ?? s.respiratory_rate ?? NaN); if (!Number.isNaN(resp)) { rec.respSum += resp; rec.respCnt += 1; }

        // SpO2 (avg) and lowest
        const spo2 = Number(s.avg_spo2 ?? NaN); if (!Number.isNaN(spo2)) { rec.spo2Sum += spo2; rec.spo2Cnt += 1; }
        const spo2Low = Number(s.lowest_spo2 ?? NaN);
        if (!Number.isNaN(spo2Low)) {
          if (rec.spo2Lowest == null || spo2Low < rec.spo2Lowest) rec.spo2Lowest = spo2Low;
        }

        // Naps
        const napsSec = Number(s.nap_duration_seconds ?? NaN); if (!Number.isNaN(napsSec)) rec.napsSecSum += napsSec;
      });
      const arr = Array.from(map.values()).sort((a,b)=> a.week < b.week ? -1 : 1).map(v => {
        const deepPct = (v.durSumSec > 0 && v.deepSecSum >= 0) ? (v.deepSecSum / v.durSumSec) * 100 : null;
        const remPct = (v.durSumSec > 0 && v.remSecSum >= 0) ? (v.remSecSum / v.durSumSec) * 100 : null;
        const awakeMinAvg = (v.nights > 0 && v.awakeSecSum >= 0) ? (v.awakeSecSum / v.nights) / 60 : null;
        const avgSleepHr = v.hrCnt > 0 ? (v.hrSum / v.hrCnt) : null;
        const avgResp = v.respCnt > 0 ? (v.respSum / v.respCnt) : null;
        const spo2Avg = v.spo2Cnt > 0 ? (v.spo2Sum / v.spo2Cnt) : null;
        const spo2Low = v.spo2Lowest != null ? v.spo2Lowest : null;
        const napsH = v.napsSecSum > 0 ? (v.napsSecSum / 3600) : 0;
        return {
          week: v.week,
          avgSleepScore: v.scoreCnt ? (v.scoreSum / v.scoreCnt) : null,
          avgDurationH: v.nights ? (v.durSumMin / v.nights) / 60 : null,
          nights: v.nights,
          dailyDurationSeries: v.dailyDur,
          deepPct, remPct, awakeMinAvg,
          avgSleepHr, avgResp,
          spo2Avg, spo2Low,
          napsH,
        };
      });

      // streak and change based on avgSleepScore
      let streak = 0;
      arr.forEach((w, i) => {
        const prev = i>0 ? arr[i-1] : null;
        const cur = w.avgSleepScore;
        const trend = (!prev || prev.avgSleepScore == null || cur == null) ? '.' : (cur > prev.avgSleepScore ? '↑' : cur < prev.avgSleepScore ? '↓' : '·');
        w.trend = trend;
        if (cur != null) streak += 1; else streak = 0;
        w.streakUp = streak;
        w.changePct = (prev && prev.avgSleepScore != null && cur != null && prev.avgSleepScore !== 0)
          ? ((cur - prev.avgSleepScore) / prev.avgSleepScore) * 100
          : null;
      });

      // rolling 4w average of sleep score
      arr.forEach((w, idx) => {
        const window = [];
        for (let i = Math.max(0, idx - 3); i <= idx; i++) {
          const v = arr[i].avgSleepScore;
          if (v != null && !Number.isNaN(v)) window.push(v);
        }
        w.rollingAvgScore4 = window.length ? (window.reduce((s,v)=>s+v,0)/window.length) : null;
        if (idx > 0) {
          const prevWindow = [];
          for (let i = Math.max(0, idx - 4); i <= idx - 1; i++) {
            const v = arr[i].avgSleepScore;
            if (v != null && !Number.isNaN(v)) prevWindow.push(v);
          }
          const prevAvg = prevWindow.length ? (prevWindow.reduce((s,v)=>s+v,0)/prevWindow.length) : null;
          w.scoreImprovementPct = (prevAvg && w.rollingAvgScore4) ? ((w.rollingAvgScore4 - prevAvg)/prevAvg)*100 : null;
        } else {
          w.scoreImprovementPct = null;
        }
      });
      // Limit to the most recent N weeks based on page size, if provided
      const weeksToShow = Math.max(1, Number(pageSize || 0) || 0);
      return weeksToShow ? arr.slice(-weeksToShow) : arr;
    } catch { return []; }
  }, [daily, pageSize]);

  const rows = useMemo(() => weekly.map(w => ({
    week: w.week,
    trend: w.trend,
    streakUp: w.streakUp ?? 0,
    changePct: w.changePct ?? null,
    avgSleepScore: w.avgSleepScore ?? null,
    avgDurationH: w.avgDurationH ?? null,
    rollingAvgScore4: w.rollingAvgScore4 ?? null,
    scoreImprovementPct: w.scoreImprovementPct ?? null,
    consistency: w.nights ?? 0,
    dailyDurationSeries: Array.isArray(w.dailyDurationSeries) ? w.dailyDurationSeries : [],
    deepPct: w.deepPct ?? null,
    remPct: w.remPct ?? null,
    awakeMinAvg: w.awakeMinAvg ?? null,
    avgSleepHr: w.avgSleepHr ?? null,
    avgResp: w.avgResp ?? null,
    spo2Avg: w.spo2Avg ?? null,
    spo2Low: w.spo2Low ?? null,
    napsH: w.napsH ?? 0,
  })), [weekly]);

  const columns = [
    { key: 'trend', label: 'Trend', format: v => <span className={v==='↑'?'text-green-600':v==='↓'?'text-red-600':'text-gray-500'}>{v || '·'}</span>, tooltip: () => 'Direction of change vs previous week' },
    { key: 'streakUp', label: 'Streak↑', tooltip: (v) => v!=null ? `Weeks with data in a row: ${v}` : null },
    { key: 'changePct', label: 'Change %', format: v => v==null?'—':`${v>0?'+':''}${v.toFixed(1)}%`, tooltip: (v,_r,prev) => prev && v!=null ? `Score change vs previous week: ${v>0?'+':''}${v.toFixed(1)}%` : null },
    { key: 'avgSleepScore', label: 'Sleep Score', format: v => v!=null ? Number(v).toFixed(1) : '—', tooltip: (v,r,prev) => (v!=null && prev?.avgSleepScore!=null) ? `This week: ${v.toFixed(1)}; Last week: ${prev.avgSleepScore.toFixed(1)}` : null },
    { key: 'avgDurationH', label: 'Duration (h:mm)', format: v => v!=null ? formatHoursToHM(v) : '—', tooltip: (v,r,prev) => (v!=null && prev?.avgDurationH!=null) ? `This week: ${formatHoursToHM(v)}; Last week: ${formatHoursToHM(prev.avgDurationH)}` : null },
    { key: 'deepPct', label: 'Deep %', format: v => v!=null ? `${Number(v).toFixed(0)}%` : '—' },
    { key: 'remPct', label: 'REM %', format: v => v!=null ? `${Number(v).toFixed(0)}%` : '—' },
    { key: 'awakeMinAvg', label: 'Awake (min)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgSleepHr', label: 'Avg Sleep HR', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'avgResp', label: 'Avg Resp', format: v => v!=null ? Number(v).toFixed(1) : '—' },
    { key: 'spo2Avg', label: 'SpO2 Avg (%)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'spo2Low', label: 'SpO2 Low (%)', format: v => v!=null ? Number(v).toFixed(0) : '—' },
    { key: 'napsH', label: 'Naps (h:mm)', format: v => formatHoursToHM(v||0) },
    { key: 'rollingAvgScore4', label: 'Rolling Score (4w)', format: v => v!=null ? Number(v).toFixed(1) : '—' },
    { key: 'scoreImprovementPct', label: 'Score Δ%', format: v => v!=null ? (<span className={v>0?'text-green-600':v<0?'text-red-600':'text-gray-500'}>{`${v>0?'+':''}${v.toFixed(1)}%`}</span>) : '—' },
    { key: 'consistency', label: 'Consistency', format: v => (<span className={v>=7?'text-green-600 font-semibold':v>=5?'text-indigo-600':v>=3?'text-yellow-600':'text-red-600'}>{v} / 7</span>), tooltip: (v)=> v!=null?`Nights with data: ${v} / 7`:null },
    { key: 'mini', label: 'Mini Dur', format: (_v,r)=> (
      <div className="w-32">
        <Sparkline data={(r.dailyDurationSeries||[]).map(v=>({value:v}))} height={26} stroke="#10b981" fill="rgba(16,185,129,0.15)" tooltipFormatter={(pt,di)=>`Night ${di+1}: ${formatHoursToHM(pt.value||0)}` } />
      </div>
    ), tooltip: () => 'Nightly durations this week' },
  ];

  return <WeeklyTrends title="Sleep Weekly" rows={rows} columns={columns} defaultSortKey="week" defaultSortDir="desc" />;
}
