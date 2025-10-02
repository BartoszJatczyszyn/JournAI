import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

/*
  useGymWorkouts
  Lightweight client-side store (localStorage) for:
  - Workout templates (exercise blueprints)
  - Logged workout sessions
  - Progress analytics (volume, top set, est 1RM, regression slope, forecast)

  Data Shapes:
  Template: {
    id, name, createdAt, progression?: {
      type: 'linear' | 'double' | 'auto',
      incrementKg: number,
      repRangeMin: number,
      repRangeMax: number,
      targetRPE: number
    },
    exercises: [{ id, name, unilateral, defaultSets, defaultReps, defaultWeight }]
  }
  Session: {
    id, date (ISO), templateId, notes?,
    exercises: [{ exerciseId, sets: [{ id, weight, reps, rpe?, tempo?, drop?:boolean }] }]
  }

  Progress per exercise derived on the fly.
*/

const LS_TEMPLATES = 'gymTemplates';
const LS_SESSIONS = 'gymSessions';
const LS_MANUAL_1RM = 'gymManual1RM';

function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function est1RM(weight, reps) {
  if (!weight || !reps) return null;
  return weight * (1 + reps / 30); // Epley formula
}

function linearRegression(points) { // points: [{x,y}]
  if (!points || points.length < 2) return null;
  const n = points.length;
  let sumX=0,sumY=0,sumXY=0,sumXX=0;
  points.forEach(p => { sumX+=p.x; sumY+=p.y; sumXY+=p.x*p.y; sumXX+=p.x*p.x; });
  const denom = (n*sumXX - sumX*sumX);
  if (denom === 0) return null;
  const slope = (n*sumXY - sumX*sumY)/denom;
  const intercept = (sumY - slope*sumX)/n;
  // r^2
  let ssTot=0, ssRes=0; const meanY = sumY/n;
  points.forEach(p => { const pred = slope*p.x + intercept; ssRes += (p.y - pred)**2; ssTot += (p.y-meanY)**2; });
  const r2 = ssTot ? 1 - (ssRes/ssTot) : 0;
  return { slope, intercept, r2 };
}

// Basic body part classifier (heuristic)
function classifyBodyPart(name='') {
  const n = name.toLowerCase();
  if (/bench|chest|crossover|fly/.test(n)) return 'chest';
  if (/row|lat|pull|pulldown|pull-down|pullover/.test(n)) return 'back';
  if (/squat|lunge|leg press|leg curl|leg extension|hamstring|quad|calf/.test(n)) return 'legs';
  if (/overhead|shoulder|lateral|press/.test(n)) return 'shoulders';
  if (/curl|bicep/.test(n)) return 'biceps';
  if (/tricep|extension/.test(n)) return 'triceps';
  if (/crunch|abs|core|wheel/.test(n)) return 'core';
  return 'other';
}

export default function useGymWorkouts() {
  const [templates, setTemplates] = useState(() => loadLS(LS_TEMPLATES, []));
  const [sessions, setSessions] = useState(() => loadLS(LS_SESSIONS, []));
  const [manualOneRMs, setManualOneRMs] = useState(() => loadLS(LS_MANUAL_1RM, [])); // [{id, exerciseId, value, date}]

  useEffect(() => { saveLS(LS_TEMPLATES, templates); }, [templates]);
  useEffect(() => { saveLS(LS_SESSIONS, sessions); }, [sessions]);
  useEffect(() => { saveLS(LS_MANUAL_1RM, manualOneRMs); }, [manualOneRMs]);

  const createTemplate = useCallback((tpl) => {
    const t = { id: uuid(), createdAt: new Date().toISOString(),
      progression: tpl.progression || { type: 'linear', incrementKg: 2.5, repRangeMin: 6, repRangeMax: 10, targetRPE: 8 },
      ...tpl,
      exercises: (tpl.exercises || []).map(e => ({ ...e })) };
    setTemplates(prev => [...prev, t]);
    return t;
  }, []);

  const updateTemplate = useCallback((id, patch) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const deleteTemplate = useCallback((id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const logSession = useCallback((session) => {
    const s = { id: uuid(), date: new Date().toISOString(), notes: '', ...session };
    setSessions(prev => [...prev, s]);
    return s;
  }, []);

  const updateSession = useCallback((id, patch) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  // Build exercise index (template-level definitions)
  const exerciseMeta = useMemo(() => {
    const map = new Map();
    templates.forEach(t => t.exercises.forEach(ex => { map.set(ex.id, { ...ex, templateName: t.name }); }));
    return map;
  }, [templates]);

  // Progress analytics per exercise id
  const exerciseProgress = useMemo(() => {
    const progress = {};
    sessions.sort((a,b)=> new Date(a.date)-new Date(b.date));
    sessions.forEach((s, idx) => {
      (s.exercises||[]).forEach(exe => {
        const exId = exe.exerciseId;
        if (!progress[exId]) progress[exId] = { history: [], volumes: [], topSets: [], est1RMSeries: [] };
        let volume = 0; let topWeight = 0; let topSetEst = null;
        (exe.sets||[]).forEach(st => {
          if (st.weight != null && st.reps != null) {
            volume += st.weight * st.reps;
            if (st.weight > topWeight) topWeight = st.weight;
            const e = est1RM(st.weight, st.reps);
            if (e && (!topSetEst || e > topSetEst)) topSetEst = e;
          }
        });
        progress[exId].history.push({ sessionId: s.id, date: s.date, index: idx, volume, topWeight, est1RM: topSetEst });
        progress[exId].volumes.push(volume);
        progress[exId].topSets.push(topWeight);
        progress[exId].est1RMSeries.push(topSetEst);
      });
    });
    // Compute regression on est1RM if enough points else on topWeight
    Object.entries(progress).forEach(([exId, data]) => {
      // Merge manual 1RM entries into history stream
      const manualEntries = manualOneRMs.filter(m => m.exerciseId === exId).sort((a,b)=> new Date(a.date)-new Date(b.date));
      // Append manual entries as synthetic history points (index after last existing index or by date mapping)
      if (manualEntries.length) {
        // We'll interleave by date ordering while preserving index ordering (assign fractional indexes if needed)
        const combined = [];
        const hist = [...data.history];
        let hPtr = 0; let syntheticIndexCounter = data.history.length ? data.history[data.history.length-1].index : 0;
        const histByDate = hist.map(h => ({ ...h, ts: new Date(h.date).getTime() }));
        manualEntries.forEach(man => { man._ts = new Date(man.date || new Date().toISOString()).getTime(); });
        const allItems = [...histByDate.map(h=>({type:'hist', item:h})), ...manualEntries.map(m=>({type:'manual', item:m}))].sort((a,b)=> a.item._ts - b.item._ts);
        const rebuilt = []; let newIndex = 0;
        allItems.forEach(obj => {
          if (obj.type === 'hist') {
            rebuilt.push({ ...obj.item, index: newIndex });
            newIndex += 1;
          } else {
            rebuilt.push({ sessionId: `manual-${obj.item.id}`, date: new Date(obj.item.date).toISOString(), index: newIndex, volume: 0, topWeight: obj.item.value, est1RM: obj.item.value, manual: true });
            newIndex += 1;
          }
        });
        data.history = rebuilt;
        data.est1RMSeries = data.history.map(h => h.est1RM);
        data.topSets = data.history.map(h => h.topWeight);
        data.volumes = data.history.map(h => h.volume);
      }
      const points = data.history.filter(h => h.est1RM).map(h => ({ x: h.index, y: h.est1RM }));
      let reg = linearRegression(points);
      if (!reg) {
        const alt = data.history.filter(h => h.topWeight).map(h => ({ x: h.index, y: h.topWeight }));
        reg = linearRegression(alt);
      }
      data.regression = reg;
      if (reg) {
        const nextIndex = data.history[data.history.length-1].index + 1;
        data.nextEst1RM = reg.slope * nextIndex + reg.intercept;
      }
      // Improvement speed per session (slope)
      data.progressSpeed = reg ? reg.slope : 0;
      // Record (max) 1RM including manual
      data.record1RM = data.est1RMSeries.filter(Boolean).reduce((m,v)=> v>m? v : m, 0) || null;
    });
    // Stagnation detection (flat slope or low r2)
    Object.entries(progress).forEach(([exId, data]) => {
      if (data.regression) {
        const base = data.est1RMSeries.filter(Boolean);
        const avg = base.length ? base.reduce((a,b)=>a+b,0)/base.length : 0;
        const relSlope = avg ? data.regression.slope / avg : 0;
        data.stagnation = (data.regression.r2 < 0.25) || (relSlope >= 0 ? relSlope < 0.002 : true); // near-flat or noisy
      } else {
        data.stagnation = false;
      }
    });

    // Correlation volume vs est1RM (Pearson) per exercise
    function pearson(xs, ys) {
      const n = xs.length; if (!n) return null;
      const mx = xs.reduce((a,b)=>a+b,0)/n; const my = ys.reduce((a,b)=>a+b,0)/n;
      let num=0,dx=0,dy=0; for (let i=0;i<n;i++){ const x=xs[i]-mx; const y=ys[i]-my; num+=x*y; dx+=x*x; dy+=y*y; }
      const denom = Math.sqrt(dx*dy); if (!denom) return null; return num/denom;
    }
    Object.values(progress).forEach(data => {
      const pairs = data.history.filter(h => h.volume && h.est1RM).map(h => [h.volume, h.est1RM]);
      if (pairs.length >= 3) {
        const xs = pairs.map(p=>p[0]); const ys = pairs.map(p=>p[1]);
        data.corrVolume1RM = pearson(xs, ys);
      } else data.corrVolume1RM = null;
    });

    return progress;
  }, [sessions, manualOneRMs]);

  const forecastExerciseTarget = useCallback((exerciseId, targetEst1RM) => {
    const data = exerciseProgress[exerciseId];
    if (!data || !data.regression || targetEst1RM == null) return null;
    const { slope, intercept } = data.regression;
  if (!slope || slope <= 0) return { achievable: false, message: 'No positive trend' };
    const lastIndex = data.history[data.history.length-1].index;
    const current = data.history[data.history.length-1].est1RM || data.history[data.history.length-1].topWeight;
  if (current >= targetEst1RM) return { achievable: true, weeks: 0, message: 'Target already reached' };
    // Solve targetEst1RM = slope * x + intercept => x
    const x = (targetEst1RM - intercept) / slope;
    const sessionsNeeded = Math.max(0, Math.ceil(x - lastIndex));
  return { achievable: true, sessionsNeeded, approxWeeks: (sessionsNeeded/3).toFixed(1), message: 'Projection' };
  }, [exerciseProgress]);

  const addManualOneRepMax = useCallback((exerciseId, value, date) => {
    if (!exerciseId || !value) return null;
    const entry = { id: uuid(), exerciseId, value: Number(value), date: date ? new Date(date).toISOString() : new Date().toISOString() };
    setManualOneRMs(prev => [...prev, entry]);
    return entry;
  }, []);

  const deleteManualOneRepMax = useCallback((id) => {
    setManualOneRMs(prev => prev.filter(m => m.id !== id));
  }, []);

  // Inline session editing utilities
  const updateSet = useCallback((sessionId, exerciseId, setId, patch) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return { ...s, exercises: s.exercises.map(ex => ex.exerciseId === exerciseId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, ...patch } : st) } : ex) };
    }));
  }, []);

  const addSet = useCallback((sessionId, exerciseId, baseSet, { drop=false, dropPercent=0 }) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return { ...s, exercises: s.exercises.map(ex => {
        if (ex.exerciseId !== exerciseId) return ex;
        let newWeight = baseSet?.weight || 0;
        if (drop && dropPercent>0) newWeight = Math.max(0, +(newWeight * (1 - dropPercent/100)).toFixed(2));
        return { ...ex, sets: [...ex.sets, { id: uuid(), weight: newWeight, reps: baseSet?.reps || 0, rpe: baseSet?.rpe || null, tempo: baseSet?.tempo || '', drop }] };
      }) };
    }));
  }, []);

  const removeSet = useCallback((sessionId, exerciseId, setId) => {
    setSessions(prev => prev.map(s => s.id===sessionId ? { ...s, exercises: s.exercises.map(ex => ex.exerciseId===exerciseId ? { ...ex, sets: ex.sets.filter(st => st.id !== setId) } : ex) } : s));
  }, []);

  const updateSessionNotes = useCallback((sessionId, notes) => {
    setSessions(prev => prev.map(s => s.id===sessionId ? { ...s, notes } : s));
  }, []);

  // Progression suggestions
  const getLoadSuggestion = useCallback((exerciseId) => {
    const meta = exerciseMeta.get(exerciseId);
    if (!meta) return null;
    const prog = exerciseProgress[exerciseId];
    if (!prog || prog.history.length === 0) return null;
    const last = prog.history[prog.history.length-1];
    const template = templates.find(t => t.exercises.some(e => e.id===exerciseId));
    const cfg = template?.progression || { type:'linear', incrementKg:2.5, repRangeMin:6, repRangeMax:10, targetRPE:8 };
    // Find last session sets for this exercise
    const lastSession = sessions.filter(s => s.exercises.some(ex => ex.exerciseId===exerciseId)).slice(-1)[0];
    const exInSession = lastSession?.exercises.find(ex => ex.exerciseId===exerciseId);
    if (!exInSession) return null;
    const sets = exInSession.sets || [];
    const allCompleted = sets.every(st => st.reps && st.weight!=null);
    const avgRPE = sets.filter(s=>s.rpe!=null).reduce((a,b)=>a+b.rpe,0) / (sets.filter(s=>s.rpe!=null).length || 1);
    if (cfg.type === 'linear') {
      if (allCompleted && (avgRPE===0 || avgRPE < cfg.targetRPE - 0.5)) return { action: 'increase-weight', amount: cfg.incrementKg };
      return { action: 'hold', reason: 'RPE high or incomplete' };
    } else if (cfg.type === 'double') {
      // If all sets at upper reps -> increase weight & reset reps to lower bound
      const allAtTop = sets.every(s => s.reps >= cfg.repRangeMax);
      if (allAtTop) return { action: 'increase-weight-reset-reps', amount: cfg.incrementKg, newReps: cfg.repRangeMin };
      // Else try adding 1 rep if avgRPE margin
      if (avgRPE < cfg.targetRPE && sets.some(s => s.reps < cfg.repRangeMax)) return { action: 'add-rep', amount: 1 };
      return { action: 'hold' };
    } else { // auto (autoregulation)
      if (avgRPE) {
        if (avgRPE < cfg.targetRPE - 1) return { action: 'increase-weight', amount: cfg.incrementKg };
        if (avgRPE > cfg.targetRPE + 0.5) return { action: 'decrease-weight', amount: cfg.incrementKg };
        return { action: 'hold' };
      }
      return { action: 'hold' };
    }
  }, [exerciseMeta, exerciseProgress, sessions, templates]);

  // Body-part tonnage (last 4 weeks)
  const bodyPartTonnage = useMemo(() => {
    const cutoff = Date.now() - 1000*60*60*24*28;
    const tonnage = {};
    sessions.forEach(s => {
      if (new Date(s.date).getTime() < cutoff) return;
      s.exercises.forEach(ex => {
        const meta = exerciseMeta.get(ex.exerciseId);
        const bp = classifyBodyPart(meta?.name);
        let vol = 0;
        ex.sets.forEach(st => { if (st.weight!=null && st.reps) vol += st.weight*st.reps; });
        tonnage[bp] = (tonnage[bp] || 0) + vol;
      });
    });
    return tonnage;
  }, [sessions, exerciseMeta]);

  // Consistency: sessions per week per template (last 6 weeks average)
  const templateConsistency = useMemo(() => {
    const cutoff = Date.now() - 1000*60*60*24*42;
    const counts = {};
    sessions.forEach(s => { if (new Date(s.date).getTime() >= cutoff) counts[s.templateId] = (counts[s.templateId]||0)+1; });
    const weeks = 6;
    const perWeek = {}; Object.entries(counts).forEach(([tplId, c]) => perWeek[tplId] = c / weeks);
    return perWeek;
  }, [sessions]);

  return {
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
  };
}
