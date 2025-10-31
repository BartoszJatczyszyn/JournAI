import React from 'react';
import { Button } from 'shared/ui';
import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useStrengthBackend } from 'hooks';
import { activitiesAPI } from '../../../infrastructure/api';
import MetricCard from 'components/MetricCard';
import TonnageTimeline from 'components/TonnageTimeline';
import WeeklyTrendsGym from '../components/WeeklyTrends';
import Volume1RMScatter from 'components/Volume1RMScatter';
import Sparkline from 'components/Sparkline';
import LoadingSpinner from 'components/LoadingSpinner';
import ErrorMessage from 'components/ErrorMessage';
import { exerciseE1RMSeries, topProgress } from '../../../infrastructure/api/strengthApi';
// Top5ByMetric removed

// Gym analytics view: tonnage, templates/sessions counts, exercise progress & forecasts
const Gym = () => {
  const {
    workouts,
    templates,
    // analytics,
    refreshWorkouts,
  } = useStrengthBackend({ initialLimit: 200 });

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
    const stamps = (workouts || []).map(w => { try { return new Date(w.startedAt || w.date || w.start_time).getTime(); } catch { return null; } }).filter(Boolean);
    return stamps.length ? Math.max(...stamps) : Date.now();
  }, [workouts]);

  const periodCutoff = useMemo(() => lastSessionTs - (periodDays * 24 * 60 * 60 * 1000), [lastSessionTs, periodDays]);

  const periodWorkouts = useMemo(() => (workouts || []).filter(w => {
    try {
      const t = new Date(w.startedAt || w.date || w.start_time).getTime();
      return !Number.isNaN(t) && t >= periodCutoff && t <= lastSessionTs;
    } catch (e) { return false; }
  }), [workouts, periodCutoff, lastSessionTs]);

  // Merge Garmin / raw activities (fitness_equipment) into periodSessions as synthetic sessions
  const combinedSessions = useMemo(() => {
    const out = [...periodWorkouts.map(w => ({ id: w.id, date: w.startedAt || w.date, exercises: (w.exercises || w.exercise_logs || []) }))];
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
  }, [periodWorkouts, latestActivities, periodCutoff, lastSessionTs]);

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
    periodWorkouts.forEach(w => {
      const day = new Date(w.startedAt || w.date).toISOString().slice(0,10);
      (w.exercises || w.exercise_logs || []).forEach(ex => {
        const exName = ex.name || ex.exercise_name || 'exercise';
        let vol = 0;
        (ex.sets || ex.exercise_sets || []).forEach(st => {
          const weight = st.weight ?? st.weight_kg;
          const reps = st.reps ?? st.repetitions;
          if (weight != null && reps) vol += Number(weight) * Number(reps);
        });
        if (vol > 0) out.push({ date: day, bodyPart: exName.toLowerCase(), volume: vol });
      });
    });
    return out;
  }, [periodWorkouts]);

  // Period totals: tonnage, sessions, templates, exercises
  const periodTotals = useMemo(() => {
    let tonnage = 0; let sets = 0; let sessionsCount = periodWorkouts.length;
    periodWorkouts.forEach(w => {
      (w.exercises || w.exercise_logs || []).forEach(ex => {
        (ex.sets || ex.exercise_sets || []).forEach(st => {
          const weight = st.weight ?? st.weight_kg;
          const reps = st.reps ?? st.repetitions;
          if (weight != null && reps) { tonnage += Number(weight) * Number(reps); sets += 1; }
        });
      });
    });
    // unique exercise identifiers by name fallback
    const exSet = new Set();
    periodWorkouts.forEach(w => (w.exercises||w.exercise_logs||[]).forEach(ex => exSet.add(ex.name || ex.exercise_name || (ex.exerciseDefinitionId || ex.exercise_definition_id || ex.exercise_id))));
    return { tonnage, sets, sessionsCount, templatesCount: templates.length, exercisesCount: exSet.size };
  }, [periodWorkouts, templates.length]);

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
    const map = new Map();
    periodWorkouts.forEach(w => (w.exercises || w.exercise_logs || []).forEach(ex => {
      const exId = ex.exerciseDefinitionId || ex.exercise_definition_id || ex.exercise_id || null;
      const name = ex.name || ex.exercise_name || (exId ? `Exercise ${exId}` : 'exercise');
      let vol = 0;
      (ex.sets || ex.exercise_sets || []).forEach(st => {
        const weight = st.weight ?? st.weight_kg;
        const reps = st.reps ?? st.repetitions;
        if (weight != null && reps) vol += Number(weight) * Number(reps);
      });
      const prev = map.get(name) || { name, exerciseId: exId, volume: 0, record1RM: 0, slope: 0 };
      prev.volume += vol;
      map.set(name, prev);
    }));
    return Array.from(map.values()).sort((a,b)=>b.volume-a.volume).slice(0,6);
  }, [periodWorkouts]);

  // Fetch backend e1RM series for top few exercises (with ids)
  const [progress, setProgress] = useState({}); // key: exerciseId -> [{day, best_e1rm}]
  const [topProg, setTopProg] = useState([]);
  useEffect(() => {
    const withIds = topExercises.filter(e => e.exerciseId);
    if (withIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(withIds.slice(0,3).map(async (e) => {
        try {
          const res = await exerciseE1RMSeries(e.exerciseId);
          return [e.exerciseId, res.series || []];
        } catch {
          return [e.exerciseId, []];
        }
      }));
      if (cancelled) return;
      const map = {};
      results.forEach(([id, series]) => { map[id] = series; });
      setProgress(map);
    })();
    return () => { cancelled = true; };
  }, [topExercises]);

  // Fetch Top progress from backend (trend by e1RM slope)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await topProgress({ days: periodDays, limit: 5 });
        if (!cancelled) setTopProg(res.items || []);
      } catch (e) {
        if (!cancelled) setTopProg([]);
      }
    })();
    return () => { cancelled = true; };
  }, [periodDays]);

  if (!workouts) return <LoadingSpinner message="Loading gym data..." />;

  return (
    <div className="page-container">
      <div className="page-header">
  <h1 className="page-title">Siłownia</h1>
  <p className="page-subtitle">Tonaż, najważniejsze ćwiczenia i szybkie podsumowania treningów siłowych.</p>
        <div className="toolbar flex items-center gap-3">
          <select value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value))} className="period-select">
            <option value={7}>Ostatnie 7 dni</option>
            <option value={14}>Ostatnie 2 tygodnie</option>
            <option value={30}>Ostatnie 30 dni</option>
            <option value={60}>Ostatnie 2 miesiące</option>
            <option value={90}>Ostatnie 3 miesiące</option>
            <option value={180}>Ostatnie 6 miesięcy</option>
            <option value={365}>Ostatni rok</option>
          </select>
          <Button as={Link} to="/gym/workouts" variant="primary" onClick={()=>refreshWorkouts()}>Przeglądaj treningi</Button>
          <Button as={Link} to="/strength/workout/new" variant="secondary">Nowy trening siłowy</Button>
        </div>
      </div>

      <div className="page-content space-y-6">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Weekly Trends</h3></div>
          <div className="card-content"><WeeklyTrendsGym /></div>
        </div>
        {busy && <LoadingSpinner message="Loading activities..." />}
        {error && <ErrorMessage message={error} />}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-3 flex flex-col gap-4">
            <MetricCard
              title={`Tonaż (${periodDays}d)`}
              value={periodTotals.tonnage.toFixed(0)}
              unit="kg"
              icon="🏋️"
              color="purple"
              subtitle={`${periodTotals.sessionsCount} sesji · ${periodTotals.sets} serii`}
              tooltip={`Suma ciężar × powtórzenia w wybranym okresie`}
            />
            <MetricCard
              title={`Minuty aktywne (${periodDays}d)`}
              value={((periodActiveMinutes || 0) / 60).toFixed(1)}
              unit="h"
              icon="⏱️"
              color="yellow"
              subtitle={`Śr. ${((avgActivePerDay || 0) / 60).toFixed(2)} h/dzień`}
              tooltip={`Szacowane minuty aktywne dla sesji siłowych`}
            />
            <MetricCard
              title={`Sesje (${periodDays}d)`}
              value={String(combinedSessionsCount)}
              unit="" 
              icon="📅"
              color="indigo"
              subtitle={`${garminSessionsCount} garmin · ${periodTotals.templatesCount} szablonów`}
            />
            <MetricCard
              title={`Ćwiczenia`}
              value={String(periodTotals.exercisesCount)}
              unit=""
              icon="⚙️"
              color="green"
              subtitle={`Śledzone ćwiczenia`}
            />
          </div>

          <div className="card md:col-span-6">
            <div className="card-header flex items-center justify-between"><h3 className="card-title">Tonaż w czasie</h3><span className="text-[10px] text-gray-500">kg</span></div>
            <div className="card-content">
              {tonnageTimelineData.length ? (
                <TonnageTimeline data={tonnageTimelineData} />
              ) : <div className="text-xs text-gray-500">Brak danych o tonażu dla wybranego okresu</div>}
            </div>
          </div>

          <div className="card md:col-span-3">
            <div className="card-header"><h3 className="card-title">Top ćwiczenia</h3></div>
            <div className="card-content space-y-3">
              {topExercises.length === 0 && <div className="text-xs text-gray-500">Brak danych</div>}
              {topExercises.map((ex) => (
                <div key={ex.id} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{ex.name}</div>
                      <div className="text-[11px] text-gray-500">Objętość (ostatnio): {ex.volume.toFixed(0)} kg</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{ex.record1RM ? ex.record1RM.toFixed(1) + ' kg' : '—'}</div>
                      <div className="text=[11px] text-gray-500">Trend: {ex.slope ? ex.slope.toFixed(2) : '—'}</div>
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
            <div className="card-header"><h3 className="card-title">Progres ćwiczeń (Est 1RM)</h3></div>
            <div className="card-content space-y-4">
              {topExercises.slice(0,3).map((ex, idx) => {
                const s = ex.exerciseId ? (progress[ex.exerciseId] || []) : [];
                const data = s.map(p => ({ x: new Date(p.day).getTime(), y: p.best_e1rm }));
                return (
                  <div key={idx} className="p-2 rounded border bg-white/50 dark:bg-gray-900/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold">{ex.name}</div>
                      <div className="text-[11px] text-gray-500">pkt: {data.length}</div>
                    </div>
                    {data.length > 1 ? (
                      <Sparkline
                        data={data.map(d => d.y)}
                        height={50}
                        stroke="#22c55e"
                        fill="rgba(34,197,94,0.15)"
                        tooltipFormatter={(p,i)=> `${new Date(s[i].day).toLocaleDateString()}: ${p.toFixed(1)} kg`}
                      />
                    ) : (
                      <div className="text-xs text-gray-500">Brak wystarczających danych</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Objętość vs Est1RM</h3></div>
            <div className="card-content">
              {topExercises.length > 0 ? (
                <Volume1RMScatter points={topExercises.map(ex => ({ volume: ex.volume, est1RM: ex.record1RM }))} />
              ) : <div className="text-xs text-gray-500">Brak danych</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card md:col-span-1">
            <div className="card-header"><h3 className="card-title">Top progres (trend Est1RM)</h3></div>
            <div className="card-content space-y-3">
              {topProg.length === 0 && <div className="text-xs text-gray-500">Brak danych trendu</div>}
              {topProg.map((it) => (
                <div key={it.exerciseId} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-[11px] text-gray-500">pkt: {it.points} · R²: {Number(it.r2 || 0).toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">Δ {Number(it.slope || 0).toFixed(2)}</div>
                      <div className="text-[11px] text-gray-500">PR: {it.lastPR ? `${it.lastPR} kg` : '—'}</div>
                    </div>
                  </div>
                  {it.lastPRDate && (
                    <div className="text-[10px] text-gray-500 mt-1">ostatni PR: {new Date(it.lastPRDate).toLocaleDateString()}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body part tonnage breakdown can be added later using backend tags */}

        <div className="card">
          <div className="card-header"><h3 className="card-title">Garmin fitness_equipment (przykładowe)</h3></div>
          <div className="card-content text-xs">
            {garminSample.length === 0 ? (
              <div className="text-gray-500">Brak aktywności fitness_equipment w wybranym zakresie</div>
            ) : (
              <div className="space-y-2">
                {garminSample.map(g => (
                  <div key={g.id} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">{g.sport}</div>
                      <div className="text-[11px] text-gray-500">{g.start_time ? new Date(g.start_time).toLocaleString() : '-'}</div>
                    </div>
                    <div className="text-[11px] text-gray-500">Czas: {g.duration_min ? `${g.duration_min} min` : '-'} · Dystans: {g.distance ? `${g.distance}` : '-'}</div>
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
