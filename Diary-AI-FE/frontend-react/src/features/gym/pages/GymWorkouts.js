import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'shared/ui';
import MetricCard from 'components/MetricCard';
import { useStrengthBackend } from 'hooks';

function tonnageOfWorkout(w) {
  let t = 0;
  (w.exercises || w.exercise_logs || []).forEach(ex => {
    (ex.sets || ex.exercise_sets || []).forEach(s => {
      const wkg = s.weight ?? s.weight_kg ?? 0;
      const reps = s.reps ?? s.repetitions ?? 0;
      t += (Number(wkg) || 0) * (Number(reps) || 0);
    });
  });
  return t;
}

const GymWorkouts = () => {
  const { workouts, templates, loadingWorkouts, loadingTemplates, removeWorkout, refreshWorkouts, refreshTemplates, saveTemplate, removeTemplate } = useStrengthBackend({ initialLimit: 200 });

  const [tplName, setTplName] = useState('');
  const [tplNotes, setTplNotes] = useState('');
  const [tplExercises, setTplExercises] = useState([{ name: '', defaultSets: 3, defaultReps: 8, defaultWeight: 0 }]);

  const addTplExercise = () => setTplExercises(prev => [...prev, { name: '', defaultSets: 3, defaultReps: 8, defaultWeight: 0 }]);
  const updateTplExercise = (idx, patch) => setTplExercises(prev => prev.map((e,i)=> i===idx? { ...e, ...patch } : e));
  const removeTplExercise = (idx) => setTplExercises(prev => prev.filter((_,i)=>i!==idx));

  const handleSaveTemplate = async () => {
    const payload = { name: tplName.trim(), notes: tplNotes, exercises: tplExercises.filter(e=>e.name.trim()) };
    if (!payload.name || payload.exercises.length===0) return;
    await saveTemplate(payload);
    setTplName(''); setTplNotes(''); setTplExercises([{ name: '', defaultSets: 3, defaultReps: 8, defaultWeight: 0 }]);
  };

  const totalTonnage = useMemo(() => workouts.reduce((s,w)=> s + tonnageOfWorkout(w), 0), [workouts]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Treningi siłowe</h1>
        <p className="page-subtitle">Wersja bez duplikacji: zarządzaj szablonami i przeglądaj zapisane treningi z backendu</p>
        <div className="flex gap-2">
          <Button as={Link} to="/strength/workout/new" variant="primary">+ Nowy trening</Button>
          <Button variant="secondary" onClick={()=>{ refreshWorkouts(); refreshTemplates(); }}>Odśwież</Button>
        </div>
      </div>

      <div className="page-content space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title={`Szablony`} value={templates.length} unit="" icon="🗂️" color="indigo" subtitle="Zapisane szablony" />
          <MetricCard title={`Treningi`} value={workouts.length} unit="" icon="📅" color="purple" subtitle="Pobrane z backendu" />
          <MetricCard title={`Tonaż`} value={totalTonnage.toFixed(0)} unit="kg" icon="🏋️" color="green" subtitle="Suma ciężar × powtórzenia" />
        </div>

        {/* Templates */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Szablony</h3></div>
          <div className="card-content space-y-4">
            {loadingTemplates ? <div className="text-xs text-gray-500">Loading templates…</div> : (
              <div className="flex flex-wrap gap-3">
                {templates.length === 0 && <div className="text-xs text-gray-500">Brak szablonów</div>}
                {templates.map(t => (
                  <div key={t.id} className="p-2 rounded border text-sm bg-white/60 dark:bg-gray-900/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{t.name}</div>
                      <button className="text-red-500 text-xs" onClick={()=>removeTemplate(t.id)}>✕</button>
                    </div>
                    <div className="text-[10px] text-gray-500">{(t.exercises||[]).length} exercises</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Utwórz szablon</h4>
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                  <input className="input input-sm" value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Push A" />
                </div>
                <div className="grow min-w-[200px]">
                  <label className="block text-xs text-gray-500 mb-1">Notatki</label>
                  <input className="input input-sm w-full" value={tplNotes} onChange={e=>setTplNotes(e.target.value)} placeholder="Opcjonalnie" />
                </div>
                <Button variant="secondary" onClick={addTplExercise}>Dodaj ćwiczenie</Button>
                <Button variant="primary" onClick={handleSaveTemplate} disabled={!tplName || tplExercises.filter(e=>e.name.trim()).length===0}>Zapisz szablon</Button>
              </div>

              {tplExercises.length>0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">Nazwa</th>
                        <th className="py-2 pr-4">Serie</th>
                        <th className="py-2 pr-4">Powt.</th>
                        <th className="py-2 pr-4">Ciężar</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tplExercises.map((e, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-1 pr-4"><input className="input input-xs" value={e.name} onChange={ev=>updateTplExercise(idx,{name:ev.target.value})} placeholder="Wyciskanie sztangi na ławce" /></td>
                          <td className="py-1 pr-4 w-16"><input type="number" className="input input-xs" value={e.defaultSets} onChange={ev=>updateTplExercise(idx,{defaultSets:Number(ev.target.value)})} min={1} /></td>
                          <td className="py-1 pr-4 w-16"><input type="number" className="input input-xs" value={e.defaultReps} onChange={ev=>updateTplExercise(idx,{defaultReps:Number(ev.target.value)})} min={1} /></td>
                          <td className="py-1 pr-4 w-20"><input type="number" className="input input-xs" value={e.defaultWeight} onChange={ev=>updateTplExercise(idx,{defaultWeight:Number(ev.target.value)})} step={0.5} min={0} /></td>
                          <td className="py-1 pr-4 text-right"><button className="text-red-500 text-xs" onClick={()=>removeTplExercise(idx)}>Usuń</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Workouts */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Treningi</h3></div>
          <div className="card-content overflow-x-auto">
            {loadingWorkouts ? <div className="text-xs text-gray-500">Ładowanie…</div> : (
              workouts.length === 0 ? <div className="text-xs text-gray-500">Brak treningów</div> : (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Data</th>
                      <th className="py-2 pr-4">Nazwa</th>
                      <th className="py-2 pr-4">Ćwiczenia</th>
                      <th className="py-2 pr-4 text-right">Tonaż</th>
                      <th></th>
                      <th className="py-2 pr-4 text-right">Szablon</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...workouts].sort((a,b)=> new Date(b.startedAt||b.date||b.start_time) - new Date(a.startedAt||a.date||a.start_time)).map(w => (
                      <tr key={w.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 pr-4 whitespace-nowrap">{w.startedAt || w.date || w.start_time ? new Date(w.startedAt || w.date || w.start_time).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4"><Link to={`/gym/workouts/${w.id}`} className="text-indigo-500 hover:underline">{w.name || 'Workout'}</Link></td>
                        <td className="py-2 pr-4">{(w.exercises || w.exercise_logs || []).length}</td>
                        <td className="py-2 pr-4 text-right">{tonnageOfWorkout(w).toFixed(0)} kg</td>
                        <td className="py-2 pr-4 text-right"><Link to={`/strength/workout/new?activityId=${w.id}`} className="text-indigo-500">Wypełnij</Link></td>
                        <td className="py-2 pr-4 text-right">
                          {templates.length ? (
                            <select className="input input-xs" defaultValue="" onChange={e=>{ const tid=e.target.value; if (tid) window.location.href=`/strength/workout/new?activityId=${w.id}&templateId=${encodeURIComponent(tid)}`; }}>
                              <option value="">Szablon…</option>
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          ) : <span className="text-[10px] text-gray-400">brak</span>}
                        </td>
                        <td className="py-2 pr-4 text-right"><button className="text-red-500" onClick={()=>removeWorkout(w.id)}>Usuń</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        <div className="text-[10px] text-gray-500">Dane pochodzą z endpointów backendu (siła). Edycja sesji inline pojawi się, gdy dostępne będą API do aktualizacji.</div>
      </div>
    </div>
  );
};

export default GymWorkouts;
