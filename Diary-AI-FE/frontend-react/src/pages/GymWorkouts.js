import React, { useMemo, useState } from 'react';
import useGymWorkouts from '../hooks/useGymWorkouts';
import Sparkline from '../components/Sparkline';
import TonnageTimeline from '../components/TonnageTimeline';
import Volume1RMScatter from '../components/Volume1RMScatter';

/*
  GymWorkouts Page
  Features:
  - Create/Edit/Delete workout templates (list of exercises)
  - Log sessions quickly based on a template (editable sets)
  - Track progress (volume, top set, est 1RM) per exercise with regression + forecast
  - Simple forecast: sessions needed to reach target est1RM
  - All data persisted in localStorage (no backend yet)
*/

const defaultExercise = () => ({ id: crypto.randomUUID(), name: '', unilateral: false, defaultSets: 3, defaultReps: 10, defaultWeight: 0 });

const ManualOneRMSection = ({ exerciseId, addManualOneRepMax, deleteManualOneRepMax, manualEntries }) => {
  const [manualValue, setManualValue] = useState('');
  const [manualDate, setManualDate] = useState('');
  const onAdd = () => {
    if (!manualValue) return;
    addManualOneRepMax(exerciseId, Number(manualValue), manualDate || undefined);
    setManualValue('');
    setManualDate('');
  };
  return (
    <div className="border-t pt-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        <input type="number" step={0.5} value={manualValue} onChange={e=>setManualValue(e.target.value)} placeholder="Manual 1RM" className="input input-xxs w-20" />
        <input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} className="input input-xxs" />
        <button className="btn btn-xxs btn-secondary" onClick={onAdd} disabled={!manualValue}>Add 1RM</button>
      </div>
      {manualEntries.length>0 && (
        <div className="space-y-1 max-h-24 overflow-auto pr-1">
          {manualEntries.slice(0,5).map(m => (
            <div key={m.id} className="flex justify-between items-center text-[10px] bg-white/60 dark:bg-gray-900/40 px-1 py-0.5 rounded">
              <span>{new Date(m.date).toLocaleDateString()} • {m.value.toFixed(1)}kg</span>
              <button className="text-red-500" onClick={()=>deleteManualOneRepMax(m.id)}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GymWorkouts = () => {
  const {
    templates,
    sessions,
    exerciseMeta,
    exerciseProgress,
    bodyPartTonnage,
    templateConsistency,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    logSession,
    updateSession,
    deleteSession,
    forecastExerciseTarget,
    updateSet,
    addSet,
    removeSet,
    updateSessionNotes,
    getLoadSuggestion,
    manualOneRMs,
    addManualOneRepMax,
    deleteManualOneRepMax,
  } = useGymWorkouts();

  const [newTplName, setNewTplName] = useState('');
  const [tplDraftExercises, setTplDraftExercises] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [loggingTemplateId, setLoggingTemplateId] = useState(null);
  const [targetEstMap, setTargetEstMap] = useState({}); // exerciseId -> target est1RM

  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId), [templates, selectedTemplateId]);
  const loggingTemplate = useMemo(() => templates.find(t => t.id === loggingTemplateId), [templates, loggingTemplateId]);

  const addDraftExercise = () => setTplDraftExercises(prev => [...prev, defaultExercise()]);
  const updateDraftExercise = (id, patch) => setTplDraftExercises(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  const removeDraftExercise = (id) => setTplDraftExercises(prev => prev.filter(e => e.id !== id));

  const handleCreateTemplate = () => {
    if (!newTplName.trim()) return;
    createTemplate({ name: newTplName.trim(), exercises: tplDraftExercises.filter(e => e.name.trim()) });
    setNewTplName('');
    setTplDraftExercises([]);
  };

  const startLogSession = (tplId) => {
    setLoggingTemplateId(tplId);
  };

  const commitSessionLog = () => {
    if (!loggingTemplate) return;
    // Build sets structure from template defaults
    const exercises = loggingTemplate.exercises.map(ex => ({
      exerciseId: ex.id,
      sets: Array.from({ length: ex.defaultSets }).map(() => ({ id: crypto.randomUUID(), weight: ex.defaultWeight || 0, reps: ex.defaultReps || 0 }))
    }));
    logSession({ templateId: loggingTemplate.id, exercises });
    setLoggingTemplateId(null);
  };

  const sessionsByTemplate = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => { if (!map.has(s.templateId)) map.set(s.templateId, []); map.get(s.templateId).push(s); });
    return map;
  }, [sessions]);

  const allExercisesList = useMemo(() => Array.from(exerciseMeta.entries()).map(([id, meta]) => ({ id, ...meta })), [exerciseMeta]);
  // Build tonnage timeline raw points from sessions
  const tonnageTimelineData = useMemo(() => {
    const arr = [];
    sessions.forEach(s => {
      const day = new Date(s.date).toISOString().slice(0,10);
      s.exercises.forEach(ex => {
        const meta = exerciseMeta.get(ex.exerciseId);
        const bp = meta?.name ? meta.name.toLowerCase() : 'other';
        let vol = 0; ex.sets.forEach(st => { if (st.weight!=null && st.reps) vol += st.weight*st.reps; });
        if (vol>0) arr.push({ date: day, bodyPart: bp.includes('bench')||bp.includes('chest')?'chest': bp.includes('row')||bp.includes('lat')?'back': bp.includes('squat')||bp.includes('leg')||bp.includes('lunge')?'legs': bp.includes('press')||bp.includes('shoulder')?'shoulders': bp.includes('curl')?'biceps': bp.includes('tricep')?'triceps': bp.includes('ab')||bp.includes('core')?'core':'other', volume: vol });
      });
    });
    return arr;
  }, [sessions, exerciseMeta]);

  // Suggestion: test 1RM if stagnation flagged for X consecutive entries (default 5 sessions with stagnation and no manual 1RM in last 30 days)
  const oneRMSuggestions = useMemo(() => {
    const suggestions = [];
    Object.entries(exerciseProgress).forEach(([exId, prog]) => {
      if (!prog || !prog.history) return;
      const recent = prog.history.slice(-5);
      const stagnationCount = recent.filter(h => prog.stagnation).length; // same flag for all points when stagnation true
      const lastManual = manualOneRMs.filter(m => m.exerciseId===exId).sort((a,b)=> new Date(b.date)-new Date(a.date))[0];
      const thirtyAgo = Date.now() - 1000*60*60*24*30;
      const needsTest = prog.stagnation && stagnationCount >= 5 && (!lastManual || new Date(lastManual.date).getTime() < thirtyAgo);
      if (needsTest) suggestions.push(exId);
    });
    return suggestions;
  }, [exerciseProgress, manualOneRMs]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Gym Workouts</h1>
  <p className="page-subtitle">Manage templates, log sessions, track progress and forecasts</p>
      </div>
      <div className="page-content space-y-8">
        {/* Template Creation */}
        <div className="card">
          <div className="card-header flex justify-between flex-wrap gap-4 items-center">
            <h3 className="card-title">New Template</h3>
          </div>
          <div className="card-content space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Template Name</label>
                <input value={newTplName} onChange={e=>setNewTplName(e.target.value)} className="input input-sm" placeholder="Push A" />
              </div>
              <button className="btn btn-secondary" onClick={addDraftExercise}>Add Exercise</button>
              <button className="btn btn-primary" onClick={handleCreateTemplate} disabled={!newTplName || tplDraftExercises.length===0}>Create</button>
            </div>
            {tplDraftExercises.length>0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Unilateral</th>
                      <th className="py-2 pr-4">Sets</th>
                      <th className="py-2 pr-4">Reps</th>
                      <th className="py-2 pr-4">Weight</th>
                      <th className="py-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tplDraftExercises.map(e => (
                      <tr key={e.id} className="border-b">
                        <td className="py-1 pr-4"><input className="input input-xs" value={e.name} onChange={ev=>updateDraftExercise(e.id,{name:ev.target.value})} placeholder="Barbell Bench Press" /></td>
                        <td className="py-1 pr-4"><input type="checkbox" checked={e.unilateral} onChange={ev=>updateDraftExercise(e.id,{unilateral:ev.target.checked})} /></td>
                        <td className="py-1 pr-4 w-16"><input type="number" className="input input-xs" value={e.defaultSets} onChange={ev=>updateDraftExercise(e.id,{defaultSets:Number(ev.target.value)})} min={1} /></td>
                        <td className="py-1 pr-4 w-16"><input type="number" className="input input-xs" value={e.defaultReps} onChange={ev=>updateDraftExercise(e.id,{defaultReps:Number(ev.target.value)})} min={1} /></td>
                        <td className="py-1 pr-4 w-20"><input type="number" className="input input-xs" value={e.defaultWeight} onChange={ev=>updateDraftExercise(e.id,{defaultWeight:Number(ev.target.value)})} step={0.5} min={0} /></td>
                        <td className="py-1 pr-4 text-right"><button className="text-red-500 text-xs" onClick={()=>removeDraftExercise(e.id)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Templates List */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Templates</h3></div>
          <div className="card-content space-y-4">
            {templates.length === 0 ? <div className="text-xs text-gray-500">No templates</div> : (
              <div className="flex flex-wrap gap-3">
                {templates.map(t => (
                  <div key={t.id} className={`px-3 py-2 rounded border text-sm flex flex-col gap-2 ${selectedTemplateId===t.id?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20':''}`}>
                    <div className="flex items-center gap-2">
                      <button className="font-semibold text-left" onClick={()=>setSelectedTemplateId(t.id)}>{t.name}</button>
                      <button className="text-xs text-blue-600" onClick={()=>startLogSession(t.id)}>Log</button>
                      <button className="text-xs text-red-500" onClick={()=>deleteTemplate(t.id)}>✕</button>
                    </div>
                    <div className="text-[10px] text-gray-500">{t.exercises.length} exercises</div>
                  </div>
                ))}
              </div>
            )}
            {selectedTemplate && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Exercises in: {selectedTemplate.name}</h4>
                <ul className="list-disc ml-5 text-xs space-y-1">
                  {selectedTemplate.exercises.map(ex => <li key={ex.id}>{ex.name} · {ex.defaultSets}x{ex.defaultReps}{ex.defaultWeight?` @${ex.defaultWeight}`:''}{ex.unilateral?' (uni)':''}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Log Session Prompt */}
        {loggingTemplate && (
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="card-title">Log Session: {loggingTemplate.name}</h3>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" onClick={()=>setLoggingTemplateId(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={commitSessionLog}>Create Session</button>
              </div>
            </div>
            <div className="card-content text-xs text-gray-500">The session will be created with default sets – edit after saving.</div>
          </div>
        )}

        {/* Sessions Table (with inline editing) */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Logged Sessions</h3></div>
          <div className="card-content overflow-x-auto">
            {sessions.length === 0 ? <div className="text-xs text-gray-500">Brak sesji</div> : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Template</th>
                    <th className="py-2 pr-4">Exercises / Sets</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s => (
                    <tr key={s.id} className="border-b align-top hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-2 pr-4 whitespace-nowrap min-w-[70px]">{new Date(s.date).toLocaleDateString()}<div className="mt-1"><textarea value={s.notes||''} onChange={e=>updateSessionNotes(s.id,e.target.value)} placeholder="Notes" className="input input-xs w-full h-12" /></div></td>
                      <td className="py-2 pr-4 w-40">
                        <div className="font-semibold text-gray-700 dark:text-gray-200">{templates.find(t=>t.id===s.templateId)?.name || '—'}</div>
                        <div className="text-[10px] text-gray-500">Consistency: {templateConsistency[s.templateId]?.toFixed?.(2) || 0}/wk</div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="space-y-3">
                          {s.exercises.map(ex => {
                            const meta = exerciseMeta.get(ex.exerciseId) || {};
                            const suggestion = getLoadSuggestion(ex.exerciseId);
                            return (
                              <div key={ex.exerciseId} className="p-2 rounded border bg-white/50 dark:bg-gray-900/30">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="font-medium">{meta.name || 'Exercise'}</div>
                                  {suggestion && <div className="text-[10px] text-indigo-600">
                                    {suggestion.action==='increase-weight' && `+${suggestion.amount}kg`}
                                    {suggestion.action==='increase-weight-reset-reps' && `+${suggestion.amount}kg reset reps`}
                                    {suggestion.action==='add-rep' && `+1 rep`} 
                                    {suggestion.action==='decrease-weight' && `-${suggestion.amount}kg`} 
                                    {suggestion.action==='hold' && 'hold'}
                                  </div>}
                                </div>
                                <table className="text-[10px] w-full">
                                  <thead>
                                    <tr className="text-left">
                                      <th className="pr-2">#</th>
                                      <th className="pr-2">Weight</th>
                                      <th className="pr-2">Reps</th>
                                      <th className="pr-2">RPE</th>
                                      <th className="pr-2">Tempo</th>
                                      <th className="pr-2"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ex.sets.map((st, idx) => (
                                      <tr key={st.id}>
                                        <td className="pr-2">{idx+1}{st.drop && '*'} </td>
                                        <td className="pr-2"><input type="number" step={0.5} className="input input-xxs w-16" value={st.weight} onChange={e=>updateSet(s.id, ex.exerciseId, st.id, { weight:Number(e.target.value) })} /></td>
                                        <td className="pr-2"><input type="number" className="input input-xxs w-14" value={st.reps} onChange={e=>updateSet(s.id, ex.exerciseId, st.id, { reps:Number(e.target.value) })} /></td>
                                        <td className="pr-2"><input type="number" step={0.5} className="input input-xxs w-14" value={st.rpe || ''} onChange={e=>updateSet(s.id, ex.exerciseId, st.id, { rpe: e.target.value===''?null:Number(e.target.value) })} /></td>
                                        <td className="pr-2"><input type="text" className="input input-xxs w-16" value={st.tempo || ''} onChange={e=>updateSet(s.id, ex.exerciseId, st.id, { tempo:e.target.value })} /></td>
                                        <td className="pr-2 text-right"><button className="text-red-500" onClick={()=>removeSet(s.id, ex.exerciseId, st.id)}>x</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="flex gap-2 mt-2">
                                  <button className="btn btn-xxs btn-secondary" onClick={()=>addSet(s.id, ex.exerciseId, ex.sets[ex.sets.length-1])}>+ Set</button>
                                  <button className="btn btn-xxs btn-outline" onClick={()=>addSet(s.id, ex.exerciseId, ex.sets[ex.sets.length-1], { drop:true, dropPercent:15 })}>+ Drop (15%)</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right align-top"><button className="text-red-500" onClick={()=>deleteSession(s.id)}>Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Exercise Progress (with stagnation flag) */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Exercise Progress & Forecast</h3></div>
          <div className="card-content space-y-6">
            {oneRMSuggestions.length>0 && (
              <div className="p-2 rounded border border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-[10px] text-amber-700 dark:text-amber-300">
                Suggested 1RM test for: {oneRMSuggestions.map(id => (exerciseMeta.get(id)?.name||'Exercise')).join(', ')} (stagnation ≥5 sessions)
              </div>
            )}
            {allExercisesList.length === 0 ? <div className="text-xs text-gray-500">No exercises</div> : (
              <div className="grid md:grid-cols-2 gap-6">
                {allExercisesList.map(ex => {
                  const prog = exerciseProgress[ex.id];
                  if (!prog) return null;
                  const estSeries = prog.history.map(h => ({ value: h.est1RM || h.topWeight || 0 }));
                  const volumeSeries = prog.history.map(h => ({ value: h.volume || 0 }));
                  const reg = prog.regression;
                  const speed = reg ? reg.slope : 0;
                  const target = targetEstMap[ex.id];
                  const forecast = target ? forecastExerciseTarget(ex.id, Number(target)) : null;
                  const manualForExercise = manualOneRMs.filter(m => m.exerciseId === ex.id).sort((a,b)=> new Date(b.date)-new Date(a.date));
                  const scatterPoints = prog.history.filter(h => h.volume && (h.est1RM || h.topWeight)).map(h => ({ volume: h.volume, est1RM: h.est1RM || h.topWeight }));
                  return (
                    <div key={ex.id} className="p-3 border rounded space-y-3 bg-gray-50 dark:bg-gray-800/40">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-sm">{ex.name}</h4>
                          <div className="text-[10px] text-gray-500">{ex.templateName}</div>
                        </div>
                        <div className="text-right text-[10px] text-gray-500">
                          {reg && <div>R² {(reg.r2).toFixed(2)}</div>}
                          {speed ? <div>Slope {speed.toFixed(2)}</div> : <div>No Trend</div>}
                          {prog.stagnation && <div className="text-red-500 font-semibold">Stagnation</div>}
                          {prog.record1RM && <div className="text-green-600 font-semibold">PR {prog.record1RM.toFixed(1)}</div>}
                          {prog.corrVolume1RM != null && <div className="text-[9px]">Corr V-1RM {prog.corrVolume1RM.toFixed(2)}</div>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1">Est 1RM / Top</div>
                          {estSeries.length>1 ? <Sparkline data={estSeries} height={40} stroke="#10b981" fill="rgba(16,185,129,0.15)" tooltipFormatter={(pt,i)=>`Session ${i+1}: ${pt.value.toFixed(1)}`} /> : <div className="text-[10px] text-gray-500">Insufficient</div>}
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1">Volume</div>
                          {volumeSeries.length>1 ? <Sparkline data={volumeSeries} height={40} stroke="#6366f1" fill="rgba(99,102,241,0.15)" tooltipFormatter={(pt,i)=>`Session ${i+1}: ${pt.value.toFixed(0)}`} /> : <div className="text-[10px] text-gray-500">Insufficient</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <input type="number" step={0.5} placeholder="Cel est1RM" className="input input-xs w-24" value={target || ''} onChange={e=>setTargetEstMap(m=>({...m,[ex.id]:e.target.value}))} />
                        {forecast && forecast.achievable && <div className="text-gray-600 dark:text-gray-300">~{forecast.sessionsNeeded} sesji (~{forecast.approxWeeks} tyg)</div>}
                        {forecast && forecast.achievable===false && <div className="text-red-500">{forecast.message}</div>}
                      </div>
                      {prog.nextEst1RM && <div className="text-[10px] text-gray-500">Next session projection: {prog.nextEst1RM.toFixed(1)}</div>}
                      {/* Manual 1RM entry */}
                      <ManualOneRMSection 
                        exerciseId={ex.id}
                        addManualOneRepMax={addManualOneRepMax}
                        deleteManualOneRepMax={deleteManualOneRepMax}
                        manualEntries={manualForExercise}
                      />
                      <div>
                        <div className="text-[10px] text-gray-500 mb-1">Volume vs est1RM</div>
                        <Volume1RMScatter points={scatterPoints} corr={prog.corrVolume1RM} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tonnage Timeline & Body Part Balance */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Tonnage Timeline & Balance</h3></div>
          <div className="card-content space-y-6">
            <TonnageTimeline data={tonnageTimelineData} />
          </div>
        </div>

        {/* Body Part Tonnage Summary */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Body Part Tonnage (4w)</h3></div>
          <div className="card-content text-xs">
            {Object.keys(bodyPartTonnage).length === 0 ? <div className="text-gray-500">Brak danych</div> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(bodyPartTonnage).map(([bp,val]) => (
                  <div key={bp} className="p-2 rounded border bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{bp}</div>
                    <div className="font-semibold">{val.toFixed(0)} kg</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] text-gray-500 space-y-1">
          <div>Est 1RM = Epley formula. Linear trend projects the next value and time to target (assuming constant momentum). Stagnation = low R² or very low slope relative to average.</div>
          <div>Load suggestions: linear (increase when RPE &lt; target), double (add reps until upper bound then +kg and reset), auto (adjust to target RPE).</div>
          <div>Local data (localStorage). Possible future backend sync (template/session CRUD endpoints).</div>
        </div>
      </div>
    </div>
  );
};

export default GymWorkouts;
