import React, { useMemo, useState } from 'react';
// Link import removed (not used in this view)
import { useActivityAggregates } from 'hooks';
import WeeklyDistanceChart from '../../../components/WeeklyDistanceChart';
import WeeklyPaceChart from '../../../components/WeeklyPaceChart';
import MetricCard from '../../../components/MetricCard';
import PaceHrChart from '../../../components/PaceHrChart';
import { formatPaceMinPerKm } from 'utils/timeUtils';
import { activitiesAPI } from 'features/activities/api';
import api from 'infrastructure/api/api';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { Button } from 'shared/ui';
import ErrorMessage from '../../../components/ErrorMessage';
// Top5ByMetric removed
// TooltipStyles injected globally in App

const Hiking = () => {
  const sportKey = 'hiking';
  const [allActivities, setAllActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(200);
  const [periodDays, setPeriodDays] = useState(() => { const raw = localStorage.getItem('hikingPeriodDays'); const parsed = Number(raw); return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30; });
  // predictions and goal-simulation not enabled on Hiking page yet

  const [analysis, setAnalysis] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('rolling');
  const [rangeStart] = useState('');
  const [rangeEnd] = useState('');

  React.useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        const res = await activitiesAPI.getLatestActivities(limit);
        setAllActivities(res.activities || []);
        try {
          let url = `/api/analytics/hiking?days=${periodDays}`;
          if (dateRangeMode === 'explicit' && rangeStart && rangeEnd) url += `&start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
          const runRes = await api.get(url);
          if (runRes && runRes.running_analysis && Array.isArray(runRes.running_analysis.runs)) setAnalysis(runRes.running_analysis);
        } catch (e) { /* ignore */ }
      } catch (e) { console.error(e); setError('Failed to load activities'); } finally { setBusy(false); }
    };
    load();
  }, [limit, periodDays, dateRangeMode, rangeStart, rangeEnd]);

  React.useEffect(() => { try { localStorage.setItem('hikingPeriodDays', String(periodDays)); } catch (e) { /* ignore */ } }, [periodDays]);

  React.useEffect(() => { const map = { 7: 100, 14: 200, 30: 400, 60: 800, 90: 1000, 180: 1500, 365: 2500 }; const newLimit = map[periodDays] || 400; if (newLimit !== limit) setLimit(newLimit); }, [periodDays, limit]);

  const lastSport = React.useMemo(() => { const timestamps = allActivities.map(a => { try { if ((a.sport || '').toLowerCase() !== sportKey) return null; const t = new Date(a.start_time).getTime(); return Number.isNaN(t) ? null : t; } catch (e) { return null; } }).filter(Boolean); return timestamps.length ? Math.max(...timestamps) : Date.now(); }, [allActivities]);

  const sportActivities = useMemo(() => { const cutoff = lastSport - (periodDays * 24 * 60 * 60 * 1000); return allActivities.filter(a => { if (!a.start_time) return false; if ((a.sport || '').toLowerCase() !== sportKey) return false; const t = new Date(a.start_time).getTime(); return !Number.isNaN(t) && t >= cutoff && t <= lastSport; }); }, [allActivities, periodDays, lastSport]);

  const aggregates = useActivityAggregates(sportActivities);
  const weeklyGroups = React.useMemo(() => (aggregates.weeklyGroups || aggregates.weeklyActivities || []), [aggregates.weeklyGroups, aggregates.weeklyActivities]);
  // predictions/simulation intentionally omitted for hiking page

  // Pace & HR UI toggles (persisted like other pages)
  const [primaryMetric, setPrimaryMetric] = useState(() => {
    try { const raw = localStorage.getItem('hikingPrimaryMetric'); return raw === 'avg_steps_per_min' ? 'avg_steps_per_min' : 'avg_pace'; } catch (e) { return 'avg_pace'; }
  });
  React.useEffect(() => { try { localStorage.setItem('hikingPrimaryMetric', primaryMetric); } catch (e) { /* ignore */ } }, [primaryMetric]);

  const [showHrZones, setShowHrZones] = useState(() => { try { return localStorage.getItem('hikingShowHrZones') !== '0'; } catch (e) { return true; } });
  const [showTrendLines, setShowTrendLines] = useState(() => { try { return localStorage.getItem('hikingShowTrendLines') !== '0'; } catch (e) { return true; } });
  const [showAvgLines, setShowAvgLines] = useState(() => { try { return localStorage.getItem('hikingShowAvgLines') !== '0'; } catch (e) { return true; } });
  const [distanceDotScale, setDistanceDotScale] = useState(() => { try { return localStorage.getItem('hikingDistanceDotScale') !== '0'; } catch (e) { return true; } });
  React.useEffect(() => { try { localStorage.setItem('hikingShowHrZones', showHrZones ? '1':'0'); } catch (e) { /* ignore */ } }, [showHrZones]);
  React.useEffect(() => { try { localStorage.setItem('hikingShowTrendLines', showTrendLines ? '1':'0'); } catch (e) { /* ignore */ } }, [showTrendLines]);
  React.useEffect(() => { try { localStorage.setItem('hikingShowAvgLines', showAvgLines ? '1':'0'); } catch (e) { /* ignore */ } }, [showAvgLines]);
  React.useEffect(() => { try { localStorage.setItem('hikingDistanceDotScale', distanceDotScale ? '1':'0'); } catch (e) { /* ignore */ } }, [distanceDotScale]);

  const [showAvgHr, setShowAvgHr] = useState(() => { try { return localStorage.getItem('hikingShowAvgHr') !== '0'; } catch (e) { return true; } });
  const [showMaxHr, setShowMaxHr] = useState(() => { try { return localStorage.getItem('hikingShowMaxHr') !== '0'; } catch (e) { return true; } });
  React.useEffect(() => { try { localStorage.setItem('hikingShowAvgHr', showAvgHr ? '1':'0'); } catch (e) { /* ignore */ } }, [showAvgHr]);
  React.useEffect(() => { try { localStorage.setItem('hikingShowMaxHr', showMaxHr ? '1':'0'); } catch (e) { /* ignore */ } }, [showMaxHr]);

  const weeksToDisplay = Math.min(52, Math.max(1, Math.ceil(periodDays / 7)));
  const buildIsoWeekKey = (d) => { const dt = new Date(d); const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); const dayNum = (tmp.getUTCDay() + 6) % 7; tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4)); const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7); const year = tmp.getUTCFullYear(); return `${year}-W${String(week).padStart(2,'0')}`; };

  const weeklyMap = new Map(weeklyGroups.map(w => [w.week, w]));
  const displayedWeeksRaw = (() => { const out = []; for (let i = weeksToDisplay - 1; i >= 0; i--) { const d = new Date(lastSport); d.setUTCDate(d.getUTCDate() - i * 7); const key = buildIsoWeekKey(d); if (weeklyMap.has(key)) out.push(weeklyMap.get(key)); else out.push({ week: key, distance: 0, rollingAvgPace4: null, activeDaysCount: 0 }); } return out; })();

  const aggregateWeeks = (weeksArr, maxPoints) => { if (!weeksArr || weeksArr.length <= maxPoints) return weeksArr; const windowSize = Math.ceil(weeksArr.length / maxPoints); const out = []; for (let i = 0; i < weeksArr.length; i += windowSize) { const slice = weeksArr.slice(i, i + windowSize); const distance = slice.reduce((s, w) => s + (w.distance != null ? w.distance : (w.total_distance_km != null ? w.total_distance_km : 0)), 0); const paceVals = slice.map(w => (w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace != null ? w.avg_pace : null))).filter(v => v != null); const rollingAvgPace4 = paceVals.length ? (paceVals.reduce((s, v) => s + v, 0) / paceVals.length) : null; const activeDays = slice.reduce((s, w) => s + (w.activeDays || w.active_days || w.active_days_count || 0), 0); const firstLabel = slice[0]?.week || ''; const lastLabel = slice[slice.length-1]?.week || ''; const label = slice.length === 1 ? firstLabel : (firstLabel && lastLabel ? `${firstLabel} → ${lastLabel}` : firstLabel || lastLabel); out.push({ week: label, distance, rollingAvgPace4, activeDays }); } return out; };

  const rawLen = displayedWeeksRaw.length; let maxPointsForDisplay = rawLen; if (periodDays <= 90) maxPointsForDisplay = rawLen; else if (periodDays <= 180) maxPointsForDisplay = Math.min(26, rawLen); else maxPointsForDisplay = Math.min(12, rawLen);

  const serverWeekly = (analysis && Array.isArray(analysis.weekly) && analysis.weekly.length > 0) ? analysis.weekly : null;
  const normalizedServerWeeks = serverWeekly ? serverWeekly.map(w => ({ week: w.week, distance: w.total_distance_km ?? w.totalDistance ?? w.distance ?? 0, rollingAvgPace4: w.avg_pace ?? w.rollingAvgPace4 ?? null, activeDays: w.active_days ?? w.activeDays ?? w.active_days_count ?? 0 })) : null;
  const usedWeeks = normalizedServerWeeks ? normalizedServerWeeks.slice(0, maxPointsForDisplay).reverse() : displayedWeeksRaw;
  const displayedWeeksFinal = aggregateWeeks(usedWeeks, maxPointsForDisplay);
  const displayedWeeks = displayedWeeksFinal;
  const distanceSeries = displayedWeeks.map((w, i) => ({ value: w.distance != null ? w.distance : (w.total_distance_km ?? 0), label: w.week || `W${i+1}` }));
  const paceSeries = displayedWeeks.map((w, i) => ({ value: w.rollingAvgPace4 != null ? w.rollingAvgPace4 : (w.avg_pace ?? null), label: w.week || `W${i+1}` }));

  // correlations not displayed on hiking page at the moment

  const periodTotals = React.useMemo(() => { try { return sportActivities.reduce((t, a) => { t.distance += Number(a.distance_km) || 0; t.durationMin += Number(a.duration_min) || 0; t.calories += Number(a.calories) || 0; return t; }, { distance: 0, durationMin: 0, calories: 0 }); } catch (e) { return { distance: 0, durationMin: 0, calories: 0 }; } }, [sportActivities]);

  const avgPerDay = React.useMemo(() => ({ distance: (periodTotals.distance || 0) / Math.max(1, Number(periodDays) || 1), durationMin: (periodTotals.durationMin || 0) / Math.max(1, Number(periodDays) || 1) }), [periodTotals, periodDays]);

  React.useEffect(() => { try { console.log('DEBUG Hiking data', { periodDays, sportActivitiesCount: sportActivities.length, sportActivitiesSample: sportActivities.slice(0,5), analysis, displayedWeeks }); } catch (e) { /* ignore */ } }, [periodDays, sportActivities, analysis, displayedWeeks]);

  return (
    <div className="page-container">
      
      <div className="page-header">
        <h1 className="page-title">Hiking Analytics</h1>
  <p className="page-subtitle">Specialized hiking metrics: distance, pace, elevation-aware trends and goal simulations.</p>
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
            <Button aria-label="Refresh data" variant="secondary" disabled={busy} onClick={() => { setLimit(l=>l); }}>Refresh</Button>
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
            <MetricCard title={`Distance (${periodDays}d)`} value={(periodTotals.distance || 0).toFixed(2)} unit="km" icon="🥾" color="indigo" subtitle={`Avg ${avgPerDay.distance.toFixed(2)} km/day · ${displayedWeeks.length} w`} tooltip={`Sum of hiking distance over the selected ${periodDays}‑day window`} />
            <MetricCard title="Rolling Pace (4w)" value={(() => { const raw = weeklyGroups[weeklyGroups.length-1]?.rollingAvgPace4; const formatted = raw != null ? formatPaceMinPerKm(raw) : '-'; return raw != null ? `${formatted}` : '-'; })()} unit="Avg Pace" icon="🥾" color="green" subtitle={`Active days: ${aggregates.activeDays} · Streak ${weeklyGroups[weeklyGroups.length-1]?.streakUp ?? 0}`} tooltip={`Latest 4-week rolling pace (lower is better).`} />
            <MetricCard title={dateRangeMode==='explicit' ? 'Hikes (range)' : `Hikes (${periodDays}d)`} value={String(sportActivities.length)} unit="hikes" icon="🗻" color="blue" subtitle={`Avg ${ (sportActivities.length / Math.max(1, periodDays)).toFixed(2) } hikes/day`} tooltip={`Average hikes per day over the selected ${dateRangeMode==='explicit'?'explicit date range':periodDays+'‑day window'} (client-side)`} />
            <MetricCard title={`Active Minutes (${periodDays}d)`} value={((periodTotals.durationMin || 0) / 60).toFixed(1)} unit="h" icon="⏱️" color="yellow" subtitle={`Avg ${((avgPerDay.durationMin || 0) / 60).toFixed(1)} h/day`} tooltip={`Sum of activity durations over the selected ${periodDays}‑day window (converted to hours)`} />
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

        {busy && sportActivities.length === 0 && <LoadingSpinner message="Loading hiking activities..." />}
        {error && sportActivities.length === 0 && <ErrorMessage message={error} />}

        <div className="grid grid-cols-1 gap-6">
          <div className="md:col-span-12 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="card-title">Pace & HR</h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <label className="text-gray-400">Primary:</label>
                  <select className="select select-sm" value={primaryMetric} onChange={e=>setPrimaryMetric(e.target.value)}>
                    <option value="avg_pace">Avg Pace</option>
                    <option value="avg_steps_per_min">Steps / min</option>
                  </select>
                </div>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showHrZones} onChange={e=>setShowHrZones(e.target.checked)} />
                  <span>HR Zones</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showTrendLines} onChange={e=>setShowTrendLines(e.target.checked)} />
                  <span>Trends</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showAvgLines} onChange={e=>setShowAvgLines(e.target.checked)} />
                  <span>Avg Lines</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={distanceDotScale} onChange={e=>setDistanceDotScale(e.target.checked)} />
                  <span>Size by km</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  
                  <span></span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showAvgHr} onChange={e=>setShowAvgHr(e.target.checked)} />
                  <span>Avg HR</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={showMaxHr} onChange={e=>setShowMaxHr(e.target.checked)} />
                  <span>Max HR</span>
                </label>
              </div>
            </div>
            <div className="card-content">
              <PaceHrChart
                runs={(analysis && Array.isArray(analysis.runs) && analysis.runs.length>0) ? analysis.runs : sportActivities}
                height={420}
                primaryMetric={primaryMetric}
                showHrZones={showHrZones}
                showTrendLines={showTrendLines}
                showAvgLines={showAvgLines}
                distanceDotScale={distanceDotScale}
                showAvgHr={showAvgHr}
                showMaxHr={showMaxHr}
              />
            </div>
          </div>
        </div>

        {/* Top5ByMetric removed */}
      </div>
    </div>
  );
};

export default Hiking;
