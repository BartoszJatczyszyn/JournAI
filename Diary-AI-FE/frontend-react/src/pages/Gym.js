import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useActivityAggregates from '../hooks/useActivityAggregates';
import Sparkline from '../components/Sparkline';
import SegmentedControl from '../components/SegmentedControl';
import { activitiesAPI } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

/*
  Gym Analytics View
  - Focuses on strength / gym related activities (heuristic match on sport name)
  - Provides weekly volume (sum distance as proxy if available, else duration), total sets/reps placeholders
  - Re-uses aggregation hook for consistency
  - Omits running-specific predictions & pace metrics
*/

const GYM_KEYWORDS = ['strength', 'gym', 'weight', 'crossfit', 'functional', 'resistance'];

const Gym = () => {
  const [allActivities, setAllActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(200);

  useEffect(() => {
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

  const gymActivities = useMemo(() => allActivities.filter(a => {
    const s = (a.sport || '').toLowerCase();
    return GYM_KEYWORDS.some(k => s.includes(k));
  }), [allActivities]);

  const aggregates = useActivityAggregates(gymActivities);
  const weeklyGroups = aggregates.weeklyGroups || [];

  // Enrich weekly groups with an "advanced volume" metric:
  // Priority order:
  // 1. trainingLoad (if available)
  // 2. durationMin * (avgHr / 100) (proxy for internal load)
  // 3. durationMin + calories/100 (fallback blended proxy)
  const enrichedWeekly = useMemo(() => weeklyGroups.map(w => {
    let advancedVolume = null;
    if (w.trainingLoad && w.trainingLoad > 0) {
      advancedVolume = w.trainingLoad;
    } else if (w.durationMin > 0 && w.avgHr) {
      advancedVolume = w.durationMin * (w.avgHr / 100);
    } else if (w.durationMin > 0) {
      advancedVolume = w.durationMin + (w.calories ? (w.calories / 100) : 0);
    } else {
      advancedVolume = (w.distance || 0) * 10; // very last resort
    }
    return { ...w, advancedVolume };
  }), [weeklyGroups]);

  // Range & sorting state (similar to Activity weekly trends)
  const [weeksRange, setWeeksRange] = useState(8); // 4 / 8 / 12
  const [weeklySortKey, setWeeklySortKey] = useState('week');
  const [weeklySortDir, setWeeklySortDir] = useState('asc');

  const toggleWeeklySort = (key) => {
    if (weeklySortKey === key) {
      setWeeklySortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setWeeklySortKey(key);
      setWeeklySortDir(key === 'week' ? 'asc' : 'desc');
    }
  };

  // Visible weeks based on selected range
  const visibleWeeks = useMemo(() => enrichedWeekly.slice(-weeksRange), [enrichedWeekly, weeksRange]);

  // For coloring & progress we base thresholds on the max advanced volume in the visible window
  const maxAdvanced = useMemo(() => visibleWeeks.reduce((m,w) => w.advancedVolume>m ? w.advancedVolume : m, 0) || 0, [visibleWeeks]);

  // (Row background coloring replaced with zebra striping + progress bar for clarity)
  const lastWeeks = visibleWeeks.slice(-8); // for the header mini charts we still show up to 8

  // Build a generic weekly volume metric: prefer duration, fallback distance
  const weeklyVolumeSeries = lastWeeks.map(w => ({
    week: w.week,
    // Show advancedVolume for the sparkline (normalized) if available, else duration fallback
    volume: w.advancedVolume != null ? w.advancedVolume : (w.durationMin > 0 ? w.durationMin : (w.distance * 10))
  }));

  const durationSpark = weeklyVolumeSeries.map(v => ({ value: v.volume }));

  // Derive intensity proxy: avgHR if present, else calories / duration
  const intensitySeries = lastWeeks.map(w => {
    let intensity = null;
    if (w.avgHr) intensity = w.avgHr;
    else if (w.calories && w.durationMin) intensity = w.calories / w.durationMin; // kcal/min
    return { value: intensity };
  }).filter(p => p.value != null);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Gym Analytics</h1>
  <p className="page-subtitle">Focused analytics for strength / functional training: volume, intensity, consistency.</p>
        <div className="toolbar flex gap-2 mt-4 flex-wrap items-center">
          <div className="flex gap-2 order-1">
            <button className="btn btn-primary" disabled={busy} onClick={() => setLimit(l => l + 100)}>Load +100</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</button>
          </div>
          <div className="ml-auto flex gap-2 order-3 md:order-2">
            <Link to="/gym/workouts" className="btn btn-outline" title="Planer treningowy">Workout Planner →</Link>
          </div>
        </div>
      </div>
      <div className="page-content space-y-6">
        {busy && gymActivities.length === 0 && <LoadingSpinner message="Loading gym activities..." />}
        {error && gymActivities.length === 0 && <ErrorMessage message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Last 8 Weeks Volume</h3>
              <span className="text-[10px] text-gray-500">units</span>
            </div>
            <div className="card-content">
              {durationSpark.length > 0 ? (
                <Sparkline data={durationSpark} height={52} stroke="#6366f1" fill="rgba(99,102,241,0.15)" tooltipFormatter={(pt,i)=>`Week ${i+1}: ${pt.value.toFixed(0)} units`} />
              ) : <div className="text-xs text-gray-500">No data</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Intensity Proxy</h3>
              <span className="text-[10px] text-gray-500">HR / kcal·min</span>
            </div>
            <div className="card-content">
              {intensitySeries.length > 1 ? (
                <Sparkline data={intensitySeries} height={52} stroke="#f59e0b" fill="rgba(245,158,11,0.15)" tooltipFormatter={(pt,i)=>`Week ${i+1}: ${pt.value.toFixed(1)}`} />
              ) : <div className="text-xs text-gray-500">Insufficient data</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Current Week Snapshot</h3>
              <span className="text-[10px] text-gray-500">Status</span>
            </div>
            <div className="card-content grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] md:text-sm">
              <div className="font-medium text-gray-500">Workouts</div><div>{gymActivities.filter(a => a.start_time && (a.sport || '').length).slice(-7).length}</div>
              <div className="font-medium text-gray-500">Duration</div><div>{aggregates.weeklyGroups?.[aggregates.weeklyGroups.length-1]?.durationMin?.toFixed?.(0) || 0} min</div>
              <div className="font-medium text-gray-500">Active Days</div><div>{aggregates.activeDays} / 7</div>
              <div className="font-medium text-gray-500">Avg HR</div><div>{weeklyGroups[weeklyGroups.length-1]?.avgHr?.toFixed?.(0) || '-'}</div>
              <div className="font-medium text-gray-500">Tr. Load</div><div>{weeklyGroups[weeklyGroups.length-1]?.trainingLoad?.toFixed?.(0) || '-'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex flex-wrap items-center justify-between gap-3">
            <h3 className="card-title">Weekly Details</h3>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-[11px] text-gray-500">Advanced Volume = heuristic proxy for weekly load</div>
              <SegmentedControl
                options={[4,8,12].map(v=>({label:`${v}w`, value:v}))}
                value={weeksRange}
                onChange={setWeeksRange}
                size="sm"
                ariaLabel="Weeks range"
              />
            </div>
          </div>
          <div className="card-content overflow-x-auto">
            {enrichedWeekly.length === 0 ? <div className="text-xs text-gray-500">No weekly data</div> : (
              <table className="min-w-full text-[11px] md:text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-700/40 align-bottom">
                    <th className="py-2 pr-4 font-medium sticky left-0 bg-gray-900/90 backdrop-blur z-10">Week</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('durationMin')}>Duration {weeklySortKey==='durationMin' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('calories')}>Calories {weeklySortKey==='calories' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('avgHr')}>Avg HR {weeklySortKey==='avgHr' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('trainingLoad')}>Training Load {weeklySortKey==='trainingLoad' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('activeDaysCount')}>Active Days {weeklySortKey==='activeDaysCount' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={()=>toggleWeeklySort('advancedVolume')}>Adv Volume {weeklySortKey==='advancedVolume' ? (weeklySortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 pr-4">Progress</th>
                    <th className="py-2 pr-4">Volume Spark</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sorted = (function() {
                      const arr = [...visibleWeeks];
                      arr.sort((a,b) => {
                        let va = a[weeklySortKey];
                        let vb = b[weeklySortKey];
                        if (va == null && vb == null) return 0;
                        if (va == null) return 1;
                        if (vb == null) return -1;
                        if (typeof va === 'number' && typeof vb === 'number') return weeklySortDir==='asc' ? va - vb : vb - va;
                        return weeklySortDir==='asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                      });
                      return arr;
                    })();
                    return sorted.map((w,i) => {
                    const pct = maxAdvanced ? (w.advancedVolume / maxAdvanced) * 100 : 0;
                    const zebra = i % 2 === 0 ? 'bg-gray-800/20' : 'bg-gray-800/10';
                    return (
                      <tr key={w.week} className={`${zebra} border-b border-gray-800/30 last:border-0 hover:bg-gray-800/40 transition`} title={`Advanced Volume: ${w.advancedVolume.toFixed(1)} (${pct.toFixed(0)}% of max in range)`}>
                        <td className="py-2 pr-4 font-mono text-[11px] sticky left-0 bg-inherit backdrop-blur z-10">{w.week}</td>
                        <td className="py-2 pr-4">{w.durationMin.toFixed(0)}</td>
                        <td className="py-2 pr-4">{w.calories.toLocaleString()}</td>
                        <td className="py-2 pr-4">{w.avgHr != null ? w.avgHr.toFixed(0) : '-'}</td>
                        <td className="py-2 pr-4">{w.trainingLoad.toFixed(0)}</td>
                        <td className="py-2 pr-4">{w.activeDaysCount} / 7</td>
                        <td className="py-2 pr-4">{w.advancedVolume.toFixed(1)}</td>
                        <td className="py-2 pr-4 w-28">
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                            <div className={`h-2 ${pct>=100?'bg-green-600':pct>=80?'bg-green-500':pct>=60?'bg-yellow-500':pct>=40?'bg-orange-500':'bg-red-500'}`} style={{ width: `${Math.min(100,pct)}%` }} />
                          </div>
                          <div className="text-[10px] mt-1 text-gray-500">{pct.toFixed(0)}%</div>
                        </td>
                        <td className="py-2 pr-4 w-32">
                          <Sparkline
                            data={w.dailyDistanceSeries.map(v => ({ value: v }))}
                            height={24}
                            stroke="#10b981"
                            fill="rgba(16,185,129,0.12)"
                            tooltipFormatter={(pt,i)=>`Day ${i+1}: ${pt.value.toFixed(2)}`}
                          />
                        </td>
                      </tr>
                    );
                    });
                    })()}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="text-[10px] text-gray-500 space-y-2">
          <div className="flex flex-wrap gap-4">
            <span><strong>Legend:</strong></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-100 border border-green-300" />Peak (&gt;=100%)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-50 border border-green-200" />High (80–99%)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-50 border border-yellow-200" />Moderate (60–79%)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-orange-50 border border-orange-200" />Low (40–59%)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-50 border border-red-200" />Very Low (&lt;40%)</span>
          </div>
          <div>Heuristic strength sport filters: {GYM_KEYWORDS.join(', ')}.</div>
          <div><strong>Advanced Volume</strong>: trainingLoad → duration * (avgHR/100) → duration + calories/100 → distance*10 (fallback). Colors and progress bar refer to the maximum in the selected range (last 12w or active range).</div>
        </div>
      </div>
    </div>
  );
};

export default Gym;
