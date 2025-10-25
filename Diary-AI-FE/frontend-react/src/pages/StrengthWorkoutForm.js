import React, { useEffect, useMemo, useState } from 'react';
import { listMuscleGroups, searchExercises, createWorkout, getSuggestion, listTemplates, upsertTemplate, listWorkouts, getWorkout } from '../services/strengthApi';
import toast from 'react-hot-toast';

const ExerciseSearch = ({ onSelect, muscleGroups }) => {
  const [query, setQuery] = useState('');
  const [mg, setMg] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      const data = await searchExercises({ query, muscleGroupId: mg ? Number(mg) : undefined });
      if (active) setResults(data);
    };
    fetch().catch(() => setResults([]));
    return () => { active = false; };
  }, [query, mg]);

  return (
    <div className="exercise-search">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exercise..." />
        <select value={mg} onChange={e => setMg(e.target.value)}>
          <option value="">All groups</option>
          {muscleGroups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', border: '1px solid #eee' }}>
        {results.map(ex => (
          <div key={ex.id} style={{ padding: 8, cursor: 'pointer' }} onClick={() => onSelect(ex)}>
            {ex.name} <small style={{ color: '#666' }}>({ex.exercise_type}, {ex.equipment_type})</small>
          </div>
        ))}
        {!results.length && <div style={{ padding: 8, color: '#888' }}>No results</div>}
      </div>
    </div>
  );
};

const SetsEditor = ({ sets, onChange }) => {
  const update = (i, patch) => {
    const next = sets.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange(next);
  };
  const add = () => {
    const n = (sets[sets.length - 1]?.setNumber || 0) + 1;
    onChange([...sets, { setNumber: n, reps: 0, weight: 0, rpe: null, isWarmup: false }]);
  };
  const remove = (i) => {
    const next = sets.filter((_, idx) => idx !== i);
    onChange(next.map((s, idx) => ({ ...s, setNumber: idx + 1 })));
  };
  return (
    <div>
      <table className="sets-table">
        <thead>
          <tr><th>Set</th><th>kg</th><th>Reps</th><th>RPE</th><th>Warmup</th><th></th></tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={i}>
              <td>{s.setNumber}</td>
              <td><input type="number" value={s.weight} onChange={e => update(i, { weight: parseFloat(e.target.value) })} /></td>
              <td><input type="number" value={s.reps} onChange={e => update(i, { reps: parseInt(e.target.value || '0', 10) })} /></td>
              <td><input type="number" step="0.5" value={s.rpe ?? ''} onChange={e => update(i, { rpe: e.target.value === '' ? null : parseFloat(e.target.value) })} /></td>
              <td><input type="checkbox" checked={!!s.isWarmup} onChange={e => update(i, { isWarmup: e.target.checked })} /></td>
              <td><button onClick={() => remove(i)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add}>Add Set</button>
    </div>
  );
};

const ExerciseBlock = ({ ex, idx, onUpdate, userId }) => {
  const [suggestion, setSuggestion] = useState(null);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const s = await getSuggestion(ex.exerciseDefinitionId, userId);
        if (active) setSuggestion(s);
      } catch (e) {
        // Intentionally ignore suggestion errors (e.g., no history yet)
        if (active) setSuggestion(null);
      }
    };
    run();
    return () => { active = false; };
  }, [ex.exerciseDefinitionId, userId]);

  const updateSets = (sets) => onUpdate({ ...ex, sets });

  return (
    <div className="exercise-block" style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4>#{idx + 1} {ex.name || `Exercise ${ex.exerciseDefinitionId}`}</h4>
      </div>
      {suggestion && suggestion.suggestions && (
        <div style={{ color: '#0a7', marginBottom: 8 }}>
          Last time: {suggestion.last?.sets}x{suggestion.last?.reps} @ {suggestion.last?.weight} kg
          <br/>
          {suggestion.suggestions[0]}
        </div>
      )}
      <SetsEditor sets={ex.sets} onChange={updateSets} />
    </div>
  );
};

export default function StrengthWorkoutForm() {
  const [userId, setUserId] = useState('default');
  const [startedAt, setStartedAt] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    listMuscleGroups().then(setMuscleGroups).catch(() => setMuscleGroups([]));
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const addExercise = (ex) => {
    setExercises((prev) => [
      ...prev,
      { exerciseDefinitionId: ex.id, name: ex.name, order: prev.length + 1, notes: '', sets: [{ setNumber: 1, reps: 5, weight: 0, rpe: null, isWarmup: false }] }
    ]);
  };

  const updateExercise = (i, patch) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? patch : e));
  };

  const removeExercise = (i) => {
    setExercises(prev => prev.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, order: idx + 1 })));
  };

  const totalVolume = useMemo(() => {
    const vols = exercises.map(ex => ex.sets.reduce((acc, s) => acc + (s.isWarmup ? 0 : (s.weight * s.reps)), 0));
    return Math.round(vols.reduce((a, b) => a + b, 0));
  }, [exercises]);

  const save = async () => {
    try {
      const payload = {
        userId,
        startedAt: startedAt || null,
        name: name || null,
        notes: notes || null,
        durationMinutes: null,
        exercises: exercises.map(e => ({
          exerciseDefinitionId: e.exerciseDefinitionId,
          order: e.order,
          notes: e.notes,
          sets: e.sets,
        })),
      };
      await createWorkout(payload);
      toast.success('Workout saved');
      // Reset minimal
      setExercises([]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Failed to save workout');
    }
  };

  const saveTemplate = async () => {
    try {
      const tplName = window.prompt('Template name?');
      if (!tplName) return;
      const tpl = {
        id: String(Date.now()),
        name: tplName,
        createdAt: new Date().toISOString(),
        notes,
        exercises: exercises.map(e => ({
          exerciseDefinitionId: e.exerciseDefinitionId,
          order: e.order,
          notes: e.notes,
          sets: e.sets,
        })),
      };
      const saved = await upsertTemplate(tpl);
      setTemplates(prev => {
        const filtered = prev.filter(t => t.id !== saved.id);
        return [...filtered, saved];
      });
      toast.success('Template saved');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Failed to save template');
    }
  };

  const loadTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    setName(tpl.name);
    setNotes(tpl.notes || '');
    setExercises((tpl.exercises || []).map((e, idx) => ({ ...e, order: e.order || (idx + 1) })));
  };

  const loadLastWorkout = async () => {
    try {
      const list = await listWorkouts({ limit: 1, userId });
      const last = (list.items || list || [])[0];
      if (!last) {
        toast('No previous workout found');
        return;
      }
      const full = await getWorkout(last.id);
      // Map backend payload to form state
      setName(full.name || name);
      setNotes(full.notes || '');
      setStartedAt('');
      const exs = (full.exercises || full.exercise_logs || []).map((e, idx) => ({
        exerciseDefinitionId: e.exerciseDefinitionId || e.exercise_definition_id || e.exercise_id,
        name: e.name, // may be undefined, UI handles fallback
        order: e.order || e.position || (idx + 1),
        notes: e.notes || '',
        sets: (e.sets || e.exercise_sets || []).map((s, i) => ({
          setNumber: s.setNumber ?? s.set_number ?? (i + 1),
          reps: s.reps ?? s.repetitions ?? 0,
          weight: s.weight ?? 0,
          rpe: s.rpe ?? null,
          isWarmup: Boolean(s.isWarmup ?? s.is_warmup ?? false),
        })),
      }));
      setExercises(exs);
      toast.success('Loaded last workout');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Failed to load last workout');
    }
  };

  return (
    <div>
      <h2>New Strength Workout</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
        <div>
          <label>User ID<br/>
            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user id" />
          </label>
        </div>
        <div>
          <label>Started At (ISO)<br/>
            <input value={startedAt} onChange={e => setStartedAt(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss" />
          </label>
        </div>
        <div>
          <label>Name<br/>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Push / Pull / Legs" />
          </label>
        </div>
        <div>
          <label>Notes<br/>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Overall RPE..." />
          </label>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Add Exercise</h3>
        <ExerciseSearch onSelect={addExercise} muscleGroups={muscleGroups} />
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={saveTemplate}>Save as Template</button>
        <button onClick={loadLastWorkout}>Load last workout</button>
        <select onChange={e => loadTemplate(e.target.value)} defaultValue="">
          <option value="">Load Template...</option>
          {templates.sort((a,b)=>a.name.localeCompare(b.name)).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        {exercises.map((ex, i) => (
          <div key={i}>
            <ExerciseBlock ex={ex} idx={i} userId={userId} onUpdate={(patch) => updateExercise(i, patch)} />
            <button onClick={() => removeExercise(i)}>Remove Exercise</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>Total Volume (working): {totalVolume} kg</div>
        <button onClick={save}>Save Workout</button>
      </div>
    </div>
  );
}
