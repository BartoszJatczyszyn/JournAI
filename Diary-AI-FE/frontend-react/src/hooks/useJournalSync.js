import { useState, useEffect, useRef, useCallback } from 'react';
import { journalAPI } from '../services';

export function useJournalSync(day, initialData) {
  const [form, setForm] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [autoStatus, setAutoStatus] = useState(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const timerRef = useRef(null);
  const lastSavedRef = useRef({});
  const isMounted = useRef(true);

  const storageKey = useCallback((d = day) => `journalQueue:${d}`, [day]);

  const loadQueue = useCallback((d = day) => {
    try {
      const raw = localStorage.getItem(storageKey(d));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('loadQueue failed', e);
      return [];
    }
  }, [storageKey]);

  const saveQueue = useCallback((queue, d = day) => {
    try {
      if (!queue || !queue.length) localStorage.removeItem(storageKey(d));
      else localStorage.setItem(storageKey(d), JSON.stringify(queue));
    } catch (e) {
      console.warn('saveQueue failed', e);
    }
  }, [storageKey]);

  const enqueueOffline = useCallback((payload) => {
    const q = loadQueue();
    q.push({ ts: Date.now(), payload });
    saveQueue(q);
    setUnsyncedCount(q.length);
  }, [loadQueue, saveQueue]);

  const sanitizeEntry = useCallback((obj) => {
    const clone = { ...obj };
    Object.keys(clone).forEach((k) => {
      if (clone[k] === '' || clone[k] == null) delete clone[k];
      else if (typeof clone[k] === 'number' && Number.isNaN(clone[k])) delete clone[k];
    });
    return clone;
  }, []);

  useEffect(() => { return () => { isMounted.current = false; if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  useEffect(() => {
    setForm(prev => ({ ...prev, ...initialData }));
    setNotes(initialData?.notes || '');
    lastSavedRef.current = sanitizeEntry({ ...(initialData || {}) });
    setStatus(null); setAutoStatus(null); setError(null); setUnsyncedCount(loadQueue().length);
  }, [initialData, day]);

  const buildFullPayload = useCallback(() => sanitizeEntry({ ...form, notes: notes?.trim() || null }), [form, notes, sanitizeEntry]);

  const buildDiffPayload = useCallback(() => {
    const full = buildFullPayload();
    const base = lastSavedRef.current || {};
    const diff = {};
    Object.keys(full).forEach((k) => { if (full[k] !== base[k]) diff[k] = full[k]; });
    return diff;
  }, [buildFullPayload]);

  const hasChanges = useCallback(() => {
    const diff = buildDiffPayload();
    return Object.keys(diff).length > 0 || unsyncedCount > 0;
  }, [buildDiffPayload, unsyncedCount]);

  const flushOfflineQueue = useCallback(async () => {
    if (isOffline) return;
    const q = loadQueue();
    if (!q.length) return;
    let remaining = [];
    for (const item of q) {
      try {
        await journalAPI.updateEntry(day, item.payload);
      } catch (e) {
        remaining = q.slice(q.indexOf(item));
        break;
      }
    }
    saveQueue(remaining);
    setUnsyncedCount(remaining.length);
    if (!remaining.length) {
      lastSavedRef.current = { ...lastSavedRef.current, ...q.reduce((a, it) => ({ ...a, ...it.payload }), {}) };
    }
  }, [isOffline, loadQueue, saveQueue, day]);

  const performSave = useCallback(async (auto = false, forceFull = false) => {
    setSaving(true);
    if (!auto) setStatus(null);
    if (auto) setAutoStatus('Saving…');
    setError(null);
    try {
      let payload = forceFull ? buildFullPayload() : buildDiffPayload();
      if (!Object.keys(payload).length && !unsyncedCount) {
        if (auto) setAutoStatus('No changes');
        setSaving(false);
        return;
      }
      if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        enqueueOffline(payload);
        setIsOffline(true);
        if (auto) setAutoStatus('Queued offline'); else setStatus('Queued offline');
        setSaving(false);
        return;
      }
      const queued = loadQueue();
      if (queued.length) {
        const merged = queued.reduce((acc, it) => ({ ...acc, ...it.payload }), {});
        payload = { ...merged, ...payload };
      }
      const res = await journalAPI.updateEntry(day, payload);
      if (!auto) setStatus(`Saved: updated [${(res.updated || []).join(', ')}]`);
      if (auto) setAutoStatus('Auto-saved');
      lastSavedRef.current = sanitizeEntry(res.entry || { ...lastSavedRef.current, ...payload });
      if (queued.length) saveQueue([]);
      setUnsyncedCount(0);
    } catch (e) {
      if (auto) setAutoStatus('Auto-save failed'); else setError(e?.response?.data?.error?.message || e.message || 'Save failed');
      if (e && (e.message?.includes('Network') || e.code === 'ERR_NETWORK')) {
        const diff = buildDiffPayload();
        if (Object.keys(diff).length) enqueueOffline(diff);
        setIsOffline(true);
      }
    } finally { setSaving(false); }
  }, [isOffline, buildFullPayload, buildDiffPayload, enqueueOffline, loadQueue, saveQueue, day, sanitizeEntry]);

  const handleSave = useCallback(() => performSave(false), [performSave]);

  const scheduleAutoSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!hasChanges()) return;
    timerRef.current = setTimeout(() => performSave(true), 1200);
  }, [hasChanges, performSave]);

  useEffect(() => { scheduleAutoSave(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [scheduleAutoSave]);

  useEffect(() => {
    const online = () => { setIsOffline(false); flushOfflineQueue(); };
    const offline = () => setIsOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [flushOfflineQueue]);

  return { form, setForm, notes, setNotes, saving, status, error, autoStatus, unsyncedCount, isOffline, hasChanges, handleSave };
}

export default useJournalSync;