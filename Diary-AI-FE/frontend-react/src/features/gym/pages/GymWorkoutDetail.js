import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from 'shared/ui';
import { getWorkout, updateWorkout } from '../../strength/api';

function ExerciseSets({ sets, onChangeSet, onAddSet, onRemoveSet, editable }) {
  return (
    <table className="min-w-full text-xs">
      <thead>
        <tr className="text-left border-b">
          <th className="py-1 pr-3">#</th>
          <th className="py-1 pr-3">Powt.</th>
          <th className="py-1 pr-3">Ciężar [kg]</th>
          <th className="py-1 pr-3">RPE</th>
          <th className="py-1 pr-3">Rozgrz.</th>
          {editable && <th></th>}
        </tr>
      </thead>
      <tbody>
        {sets.map((s, idx) => (
          <tr key={idx} className="border-b">
            <td className="py-1 pr-3 w-10">{s.setNumber ?? idx+1}</td>
            <td className="py-1 pr-3 w-16">
              {editable ? <input type="number" className="input input-xs" value={s.reps ?? ''} onChange={e=>onChangeSet(idx,{ reps: Number(e.target.value) })} /> : (s.reps ?? '-')}
            </td>
            <td className="py-1 pr-3 w-20">
              {editable ? <input type="number" step="0.5" className="input input-xs" value={s.weight ?? ''} onChange={e=>onChangeSet(idx,{ weight: Number(e.target.value) })} /> : (s.weight ?? '-')}
            </td>
            <td className="py-1 pr-3 w-16">
              {editable ? <input type="number" step="0.5" className="input input-xs" value={s.rpe ?? ''} onChange={e=>onChangeSet(idx,{ rpe: e.target.value===''? null : Number(e.target.value) })} /> : (s.rpe ?? '-')}
            </td>
            <td className="py-1 pr-3 w-16">
              {editable ? <input type="checkbox" checked={!!s.isWarmup} onChange={e=>onChangeSet(idx,{ isWarmup: e.target.checked })} /> : (s.isWarmup ? '✓' : '')}
            </td>
            {editable && (
              <td className="py-1 pr-3 text-right">
                <button className="text-red-500" onClick={()=>onRemoveSet(idx)}>Usuń</button>
              </td>
            )}
          </tr>
        ))}
        {editable && (
          <tr>
            <td colSpan={5} className="py-1 pr-3 text-left">
              <Button variant="secondary" onClick={onAddSet}>+ Dodaj serię</Button>
            </td>
            <td></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function GymWorkoutDetail(){
  const { id } = useParams();
  const [workout, setWorkout] = useState(null);
  const [editable, setEditable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const w = await getWorkout(id);
      // Normalize shapes to frontend edit schema
      const normalized = {
        id: w.id,
        startedAt: w.started_at || w.startedAt || w.start_time,
        name: w.name,
        notes: w.notes,
        durationMinutes: w.duration_minutes || w.durationMinutes,
        exercises: (w.exercises || []).map((ex, idx) => ({
          exerciseDefinitionId: ex.exercise_definition_id || ex.exerciseDefinitionId,
          order: ex.ord || ex.order || (idx+1),
          notes: ex.notes || '',
          sets: (ex.sets || []).map((s, sidx) => ({
            setNumber: s.set_number || s.setNumber || (sidx+1),
            reps: s.reps,
            weight: s.weight,
            rpe: s.rpe,
            isWarmup: s.is_warmup || s.isWarmup || false,
          }))
        }))
      };
      setWorkout(normalized);
    })();
  }, [id]);

  const totalVolume = useMemo(() => {
    if (!workout) return 0;
    let t = 0;
    workout.exercises.forEach(ex => (ex.sets||[]).forEach(s => { if (!s.isWarmup) t += (Number(s.weight)||0) * (Number(s.reps)||0); }));
    return t;
  }, [workout]);

  const onChangeHeader = (patch) => setWorkout(prev => ({ ...prev, ...patch }));
  const onChangeExercise = (idx, patch) => setWorkout(prev => ({ ...prev, exercises: prev.exercises.map((e,i)=> i===idx? { ...e, ...patch } : e) }));
  const onChangeSet = (exIdx, setIdx, patch) => setWorkout(prev => ({ ...prev, exercises: prev.exercises.map((e,i)=> i===exIdx? { ...e, sets: e.sets.map((s,j)=> j===setIdx? { ...s, ...patch } : s) } : e) }));
  const onAddSet = (exIdx) => setWorkout(prev => ({ ...prev, exercises: prev.exercises.map((e,i)=> i===exIdx? { ...e, sets: [...(e.sets||[]), { setNumber: (e.sets?.length||0)+1, reps: 0, weight: 0, rpe: null, isWarmup: false }] } : e) }));
  const onRemoveSet = (exIdx, setIdx) => setWorkout(prev => ({ ...prev, exercises: prev.exercises.map((e,i)=> i===exIdx? { ...e, sets: e.sets.filter((_,j)=> j!==setIdx).map((s,j)=> ({...s, setNumber: j+1})) } : e) }));

  const save = async () => {
    setSaving(true);
    try {
  const payload = { ...workout };
  delete payload.id;
      const updated = await updateWorkout(workout.id, payload);
      setWorkout({ ...payload, id: updated.id });
      setEditable(false);
    } finally {
      setSaving(false);
    }
  };

  if (!workout) return <div className="page-container"><div className="page-header"><h1 className="page-title">Trening</h1></div><div className="page-content">Ładowanie…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Button as={Link} to="/gym/workouts" variant="secondary">← Powrót</Button>
          <h1 className="page-title">{workout.name || 'Trening'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!editable ? (
            <Button variant="primary" onClick={()=>setEditable(true)}>Edytuj</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={()=>setEditable(false)} disabled={saving}>Anuluj</Button>
              <Button variant="primary" onClick={save} disabled={saving}>{saving? 'Zapisywanie…' : 'Zapisz'}</Button>
            </>
          )}
        </div>
      </div>
      <div className="page-content space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card"><div className="card-content"><div className="text-xs text-gray-500">Data</div><div className="text-lg">{workout.startedAt ? new Date(workout.startedAt).toLocaleString() : '-'}</div></div></div>
          <div className="card"><div className="card-content"><div className="text-xs text-gray-500">Tonaż</div><div className="text-lg">{totalVolume.toFixed(0)} kg</div></div></div>
          <div className="card"><div className="card-content"><div className="text-xs text-gray-500">Czas</div><div className="text-lg">{workout.durationMinutes ?? '-'} min</div></div></div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Szczegóły sesji</h3></div>
          <div className="card-content space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                {editable ? (
                  <input className="input" value={workout.name || ''} onChange={e=>onChangeHeader({ name: e.target.value })} />
                ) : (
                  <div>{workout.name || '-'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notatki</label>
                {editable ? (
                  <input className="input" value={workout.notes || ''} onChange={e=>onChangeHeader({ notes: e.target.value })} />
                ) : (
                  <div>{workout.notes || '-'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Czas [min]</label>
                {editable ? (
                  <input type="number" className="input" value={workout.durationMinutes ?? ''} onChange={e=>onChangeHeader({ durationMinutes: e.target.value===''? null : Number(e.target.value) })} />
                ) : (
                  <div>{workout.durationMinutes ?? '-'}</div>
                )}
              </div>
            </div>

            {(workout.exercises || []).map((ex, idx) => (
              <div key={idx} className="rounded border p-3 bg-white/50 dark:bg-gray-900/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Ćwiczenie #{ex.order || idx+1}</div>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 mb-1">Notatki</label>
                  {editable ? (
                    <input className="input input-sm" value={ex.notes || ''} onChange={e=>onChangeExercise(idx,{ notes: e.target.value })} />
                  ) : (
                    <div className="text-sm">{ex.notes || '-'}</div>
                  )}
                </div>
                <ExerciseSets
                  sets={ex.sets || []}
                  editable={editable}
                  onChangeSet={(setIdx, patch)=>onChangeSet(idx, setIdx, patch)}
                  onAddSet={()=>onAddSet(idx)}
                  onRemoveSet={(setIdx)=>onRemoveSet(idx, setIdx)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
