import React from 'react';
import { Button } from '../components/ui';
import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import useGymWorkouts from '../hooks/useGymWorkouts';
import { activitiesAPI } from '../services';
import MetricCard from '../components/MetricCard';
import TonnageTimeline from '../components/TonnageTimeline';
import Volume1RMScatter from '../components/Volume1RMScatter';
import Sparkline from '../components/Sparkline';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
// Top5ByMetric removed

// Gym analytics view: tonnage, templates/sessions counts, exercise progress & forecasts
const Gym = () => {
  const {
    templates,
    sessions,
    exerciseMeta,
    exerciseProgress,
    bodyPartTonnage,
  } = useGymWorkouts();

  const [latestActivities, setLatestActivities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        const res = await activitiesAPI.getLatestActivities(1000);
        setLatestActivities(res.activities || []);
      } catch (e) {
        console.warn('Failed to load latest activities for gym page', e);
        setError('Failed to load activities');
      } finally {
        setBusy(false);
      }
    };
    load();
  }, []);

  const [periodDays, setPeriodDays] = useState(() => {
    try {
      const raw = localStorage.getItem('gymPeriodDays');
      const parsed = Number(raw);
      return (!Number.isNaN(parsed) && parsed > 0) ? parsed : 30;
    } catch (e) {
      return 30;
    }
  });

  useEffect(() => { try { localStorage.setItem('gymPeriodDays', String(periodDays)); } catch (e) { console.warn('Failed to persist gymPeriodDays', e); } }, [periodDays]);

  const lastSessionTs = useMemo(() => {
    const stamps = sessions.map(s => { try { return new Date(s.date).getTime(); } catch { return null; } }).filter(Boolean);
    return stamps.length ? Math.max(...stamps) : Date.now();
  }, [sessions]);

  const periodCutoff = useMemo(() => lastSessionTs - (periodDays * 24 * 60 * 60 * 1000), [lastSessionTs, periodDays]);

  const periodSessions = useMemo(() => sessions.filter(s => {
    try {
      const t = new Date(s.date).getTime();
      return !Number.isNaN(t) && t >= periodCutoff && t <= lastSessionTs;
    } catch (e) { return false; }
  }), [sessions, periodCutoff, lastSessionTs]);

  // Merge Garmin / raw activities (fitness_equipment) into periodSessions as synthetic sessions
  const combinedSessions = useMemo(() => {
    const out = [...periodSessions];
    try {
      (latestActivities || []).forEach(a => {
        const sport = (a.sport || '').toLowerCase();
        if (sport === 'fitness_equipment' || sport === 'fitness-equipment' || sport === 'fitness equipment') {
          const t = new Date(a.start_time || a.date || a.timestamp).getTime();
          if (isNaN(t)) return;
          if (t < periodCutoff || t > lastSessionTs) return;
          // create a light-weight session-like object to include in metrics
          const durationMin = Number(a.duration_min ?? a.duration ?? a.moving_time ?? a.elapsed_time ?? 0) || 0;
          out.push({ id: a.activity_id || a.id || `act-${t}`, date: new Date(t).toISOString(), duration_min: durationMin, garminActivity: true, raw: a });
        }
      });
    } catch (e) { /* ignore */ }
    return out;
  }, [periodSessions, latestActivities, periodCutoff, lastSessionTs]);

  const combinedSessionsCount = combinedSessions.length;
  const garminSessionsCount = combinedSessions.filter(s => s.garminActivity).length;

  // sample list of matched garmin activities (in window)
  const garminSample = useMemo(() => {
    try {
      return (latestActivities || []).filter(a => {
        const sport = (a.sport || '').toLowerCase();
        if (!(sport === 'fitness_equipment' || sport === 'fitness-equipment' || sport === 'fitness equipment')) return false;
        const t = new Date(a.start_time || a.date || a.timestamp).getTime();
        if (isNaN(t)) return false;
        return t >= periodCutoff && t <= lastSessionTs;
      }).slice(0, 12).map(a => ({ id: a.activity_id || a.id, sport: a.sport, start_time: a.start_time || a.date || a.timestamp, distance: a.distance_km ?? a.distance, duration_min: a.duration_min ?? a.duration }));
    } catch (e) { return []; }
  }, [latestActivities, periodCutoff, lastSessionTs]);

  // compute tonnage timeline points compatible with TonnageTimeline
  const tonnageTimelineData = useMemo(() => {
    const out = [];
    periodSessions.forEach(s => {
      const day = new Date(s.date).toISOString().slice(0,10);
      (s.exercises || []).forEach(ex => {
        const meta = exerciseMeta.get(ex.exerciseId) || {};
        const name = meta.name || 'exercise';
        let vol = 0;
        (ex.sets || []).forEach(st => { if (st.weight != null && st.reps) vol += st.weight * st.reps; });
        if (vol > 0) {
          out.push({ date: day, bodyPart: name.toLowerCase(), volume: vol });
        }
      });
    });
    return out;
  }, [periodSessions, exerciseMeta]);

  // Period totals: tonnage, sessions, templates, exercises
  const periodTotals = useMemo(() => {
    let tonnage = 0; let sets = 0; let sessionsCount = periodSessions.length;
    periodSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        (ex.sets || []).forEach(st => { if (st.weight!=null && st.reps) { tonnage += st.weight * st.reps; sets += 1; } });
      });
    });
    return { tonnage, sets, sessionsCount, templatesCount: templates.length, exercisesCount: exerciseMeta.size };
  }, [periodSessions, templates.length, exerciseMeta]);

  // Active minutes: prefer explicit session.duration_min / duration, else estimate by sets * 3min (reasonable default)
  const periodActiveMinutes = useMemo(() => {
    try {
      return combinedSessions.reduce((sum, s) => {
        const explicit = Number(s.duration_min ?? s.duration ?? s.durationMin ?? null);
        if (!Number.isNaN(explicit) && explicit > 0) return sum + explicit;
        // estimate from sets: assume ~3 minutes per set (includes rest & transition)
        const setsCount = (s.exercises || []).reduce((c, ex) => c + ((ex.sets && ex.sets.length) || 0), 0);
        if (setsCount > 0) return sum + setsCount * 3;
        // fallback per-session estimate: shorter for Garmin quick workouts (30m)
        return sum + (s.garminActivity ? 30 : 45);
      }, 0);
    } catch (e) { return 0; }
  }, [combinedSessions]);

  const avgActivePerDay = useMemo(() => {
    const days = Math.max(1, Number(periodDays) || 1);
    return (periodActiveMinutes || 0) / days;
  }, [periodActiveMinutes, periodDays]);

  // Top N exercises by recent volume / progress
  const topExercises = useMemo(() => {
    const arr = Object.entries(exerciseProgress || {}).map(([id, p]) => ({ id, name: exerciseMeta.get(id)?.name || 'Exercise', record1RM: p.record1RM || 0, volume: (p.history || []).slice(-6).reduce((s,h)=>s+(h.volume||0),0), slope: p.progressSpeed || 0 }));
    arr.sort((a,b) => b.volume - a.volume);
    return arr.slice(0,6);
  }, [exerciseProgress, exerciseMeta]);

  if (!sessions) return <LoadingSpinner message="Loading gym data..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Gym Analytics</h1>
        <p className="page-subtitle">Tonnage, exercise progress and simple forecasts for strength training.</p>
        <div className="toolbar flex items-center gap-3">
          <select value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value))} className="period-select">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 2 months</option>
            <option value={90}>Last 3 months</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 1 year</option>
          </select>
          <Button as={Link} to="/gym/workouts" variant="primary">Open Workouts</Button>
        </div>
      </div>

      <div className="page-content space-y-6">
        {busy && <LoadingSpinner message="Loading activities..." />}
        {error && <ErrorMessage message={error} />}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-3 flex flex-col gap-4">
            <MetricCard
              title={`Tonnage (${periodDays}d)`}
              value={periodTotals.tonnage.toFixed(0)}
              unit="kg"
              icon="🏋️"
              color="purple"
              subtitle={`${periodTotals.sessionsCount} sessions · ${periodTotals.sets} sets`}
              tooltip={`Sum of weight × reps across logged sets in the selected window`}
            />
            <MetricCard
              title={`Active Minutes (${periodDays}d)`}
              value={((periodActiveMinutes || 0) / 60).toFixed(1)}
              unit="h"
              icon="⏱️"
              color="yellow"
              subtitle={`Avg ${((avgActivePerDay || 0) / 60).toFixed(2)} h/day`}
              tooltip={`Estimated active minutes for gym sessions in the selected window`}
            />
            <MetricCard
              title={`Sessions (${periodDays}d)`}
              value={String(combinedSessionsCount)}
              unit="" 
              icon="📅"
              color="indigo"
              subtitle={`${garminSessionsCount} garmin · ${periodTotals.templatesCount} templates`}
            />
            <MetricCard
              title={`Exercises`}
              value={String(periodTotals.exercisesCount)}
              unit=""
              icon="⚙️"
              color="green"
              subtitle={`Tracked exercises`}
            />
          </div>

          <div className="card md:col-span-6">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Tonnage Timeline</h3><span className="text-[10px] text-gray-500">kg</span></div>
            <div className="card-content">
              {tonnageTimelineData.length ? (
                <TonnageTimeline data={tonnageTimelineData} />
              ) : <div className="text-xs text-gray-500">No tonnage data for selected period</div>}
            </div>
          </div>

          <div className="card md:col-span-3">
            <div className="card-header"><h3 className="card-title">Top Exercises</h3></div>
            <div className="card-content space-y-3">
              {topExercises.length === 0 && <div className="text-xs text-gray-500">No exercise progress yet</div>}
              {topExercises.map((ex) => (
                <div key={ex.id} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{ex.name}</div>
                      <div className="text-[11px] text-gray-500">Vol (recent): {ex.volume.toFixed(0)} kg</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{ex.record1RM ? ex.record1RM.toFixed(1) + ' kg' : '—'}</div>
                      <div className="text-[11px] text-gray-500">Slope: {ex.slope ? ex.slope.toFixed(2) : '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top5ByMetric removed */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 card">
            <div className="card-header"><h3 className="card-title">Exercise Progress (Est 1RM)</h3></div>
            <div className="card-content space-y-4">
              {Object.keys(exerciseProgress || {}).length === 0 ? (
                <div className="text-xs text-gray-500">No progress data available</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(exerciseProgress).slice(0,6).map(([id, prog]) => {
                    const meta = exerciseMeta.get(id) || {};
                    const estSeries = prog.history.map(h => ({ value: h.est1RM || h.topWeight || 0 }));
                    return (
                      <div key={id} className="p-3 rounded border bg-gray-50 dark:bg-gray-900/30">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-semibold">{meta.name || 'Exercise'}</div>
                            <div className="text-[11px] text-gray-500">PR: {prog.record1RM ? prog.record1RM.toFixed(1)+' kg' : '—'}</div>
                          </div>
                          <div className="text-[11px] text-gray-500">Slope {prog.progressSpeed ? prog.progressSpeed.toFixed(2) : '—'}</div>
                        </div>
                        <div>
                          {estSeries.length > 1 ? (
                            <Sparkline data={estSeries} height={48} stroke="#10b981" fill="rgba(16,185,129,0.12)" tooltipFormatter={(pt,i)=>`#${i+1}: ${pt.value.toFixed(1)} kg`} />
                          ) : <div className="text-xs text-gray-500">Insufficient points</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Volume vs Est1RM</h3></div>
            <div className="card-content">
              {topExercises.length > 0 ? (
                <Volume1RMScatter points={topExercises.map(ex => ({ volume: ex.volume, est1RM: ex.record1RM }))} />
              ) : <div className="text-xs text-gray-500">No scatter data</div>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Body Part Tonnage (last 4w)</h3></div>
          <div className="card-content text-xs">
            {Object.keys(bodyPartTonnage || {}).length === 0 ? <div className="text-gray-500">No data</div> : (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {Object.entries(bodyPartTonnage).map(([bp, val]) => (
                  <div key={bp} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                    <div className="text-[10px] uppercase text-gray-500">{bp}</div>
                    <div className="font-semibold">{val.toFixed(0)} kg</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Garmin fitness_equipment (sample)</h3></div>
          <div className="card-content text-xs">
            {garminSample.length === 0 ? (
              <div className="text-gray-500">No matching Garmin fitness_equipment activities in selected window</div>
            ) : (
              <div className="space-y-2">
                {garminSample.map(g => (
                  <div key={g.id} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">{g.sport}</div>
                      <div className="text-[11px] text-gray-500">{g.start_time ? new Date(g.start_time).toLocaleString() : '-'}</div>
                    </div>
                    <div className="text-[11px] text-gray-500">Duration: {g.duration_min ? `${g.duration_min} min` : '-'} · Distance: {g.distance ? `${g.distance}` : '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Gym;
