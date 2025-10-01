import React, { useEffect, useState, useCallback } from 'react';
import JournalEditor from '../components/JournalEditor';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { journalAPI } from '../services';
import { Link } from 'react-router-dom';

// Lightweight page focusing on the most recent (preferably today's) journal entry.
// If no entry exists yet it will (by default) create a stub for today.
export default function Today() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState(null);
  const [day, setDay] = useState(null);
  const [isToday, setIsToday] = useState(false);
  const [created, setCreated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await journalAPI.getLatest(true); // create stub if missing
      // Some axios interceptors already unwrap data; ensure we have plain object
      const payload = res && typeof res === 'object' ? res : {};
      setEntry(payload.entry || null);
      setDay(payload.day || (payload.entry && payload.entry.day) || null);
      setIsToday(!!payload.is_today);
      setCreated(!!payload.created);
      if (!payload.day && !payload.entry) {
        setError('No data returned from /journal/latest');
      }
    } catch(e) {
      const msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (updated) => {
    // Merge updates into local state for immediate feedback
    setEntry(prev => ({ ...(prev||{}), ...(updated?.entry || {} ) }));
  };

  if (loading) return <div style={{padding:'2rem'}}><LoadingSpinner /> Loading latest entry...</div>;
  if (error) return <div style={{padding:'2rem'}}><ErrorMessage message={error} /></div>;
  if (!day) return <div style={{padding:'2rem'}}>No journal entries.</div>;

  const heading = isToday ? "Today's Journal" : `Latest entry: ${day}`;

  return (
    <div className="today-page">
      <div className="today-header">
        <h2>{heading}</h2>
        <div className="today-meta">
          {created && <span className="badge">Created new</span>}
          {!isToday && <Link to={`/days/${day}`} className="link-inline">Go to day</Link>}
          <button className="refresh-btn" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="editor-wrapper">
        <JournalEditor day={day} initialData={entry} onSaved={handleSaved} />
      </div>
      <style jsx>{`
        .today-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
        .today-meta { display:flex; align-items:center; gap:.75rem; }
        .badge { background:#2563eb; color:#fff; padding:4px 10px; border-radius:14px; font-size:.7rem; letter-spacing:.5px; text-transform:uppercase; }
        .refresh-btn { background:var(--btn-bg,#0f172a); color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:.8rem; }
        .refresh-btn:hover { opacity:.85; }
        .dark .refresh-btn { background:#1e40af; }
        .editor-wrapper { background:rgba(255,255,255,0.6); padding:1rem; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,0.08); }
        .dark .editor-wrapper { background:rgba(30,41,59,0.6); }
      `}</style>
    </div>
  );
}
