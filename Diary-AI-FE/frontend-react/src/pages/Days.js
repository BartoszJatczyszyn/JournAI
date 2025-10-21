import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { healthAPI2, journalAPI, sleepsAPI } from '../services';
import DayCard from '../components/DayCard';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import TopCorrelationPairs from '../components/TopCorrelationPairs';
import { RangeControls } from '../components/ui';

const formatDate = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  } catch { return String(d); }
};

// (date normalization helpers)

// Return start-of-day ms (local) for stable membership comparison
const dayStartMs = (input) => {
  if (!input && input !== 0) return null;
  try {
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) return null;
      const dt = new Date(input);
      dt.setHours(0,0,0,0);
      return dt.getTime();
    }
    const s = String(input).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const dt = new Date(`${s}T00:00:00`);
      if (!Number.isNaN(dt.getTime())) { dt.setHours(0,0,0,0); return dt.getTime(); }
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('/');
      const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
      if (!Number.isNaN(dt.getTime())) { dt.setHours(0,0,0,0); return dt.getTime(); }
    }
    // fallback to Date.parse
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const dt = new Date(parsed);
      dt.setHours(0,0,0,0);
      return dt.getTime();
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// Return start-of-day ms in UTC for stable comparisons against UTC timestamps
const dayStartMsUTC = (input) => {
  if (!input && input !== 0) return null;
  try {
    const s = (input instanceof Date) ? input.toISOString() : String(input).trim();
    // try to parse into a Date object
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const dt = new Date(parsed);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const d = dt.getUTCDate();
      return Date.UTC(y, m, d);
    }
  } catch (e) {
    // ignore
  }
  return null;
};

const formatMinutesToHhMm = (mins) => {
  if (mins == null || isNaN(mins)) return '-';
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const fmtNumber = (n) => {
  if (n == null || n === '') return '-';
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString();
};

const Days = () => {
  const [daysRange, setDaysRange] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [recovery, setRecovery] = useState([]);
  const [daysWithSleep, setDaysWithSleep] = useState(new Set());
  const [showCorr, setShowCorr] = useState(false);
  const [corr, setCorr] = useState(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrMethod, setCorrMethod] = useState('pearson');
  const [corrRange, setCorrRange] = useState(30);
  const [corrMinAbs, setCorrMinAbs] = useState(0.0);
  const [corrCategories, setCorrCategories] = useState({ ratings: true, metrics: true, flags: true });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await healthAPI2.getHealthData(daysRange);
      const arr = Array.isArray(resp) ? resp : (resp?.data || []);
      const norm = (arr || []).map(r => ({
        day: r.day ?? r.date ?? r.label ?? r.x,
        sleep_score: r.sleep_score ?? r.sleepScore ?? null,
        avg_stress: r.stress_avg ?? r.avg_sleep_stress ?? r.avg_stress ?? r.stress ?? null,
        rhr: r.rhr ?? r.avg_rhr ?? r.avg_sleep_hr ?? null,
        // handle several possible respiration field names from different schemas
        // prefer explicit avg_rr when available
        resp_avg: r.avg_rr ?? r.avg_sleep_rr ?? r.respiration_rate ?? r.respiration_avg ?? r.resp_rate ?? null,
        resp_max: r.max_rr ?? r.respiration_max ?? r.resp_max ?? null,
        steps: r.steps ?? null,
        tib_minutes: r.time_in_bed_minutes ?? r.time_in_bed ?? r.tib ?? r.sleep_duration_minutes ?? null,
        raw: r
      }));
      setRows(norm);
    } catch (e) {
      console.error('Failed to load daily summaries', e);
      setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }, [daysRange]);

    // wrap load in useCallback properly (separate stable reference)
    const _loadRef = React.useRef();
    _loadRef.current = load;
    useEffect(() => { _loadRef.current(); }, [daysRange]);

  useEffect(() => {
    const fetchRecovery = async () => {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - daysRange + 1);
        const toISO = d => d.toISOString().slice(0,10);
        const res = await journalAPI.getRecoveryComposite(toISO(start), toISO(end));
        setRecovery(res?.data || []);
      } catch (e) {
        console.warn('Recovery composite load failed', e);
      }
    };
    fetchRecovery();
  }, [daysRange]);

  // fetch sleeps within the same range so we can mark days that have/no sleep sessions
  useEffect(() => {
    const fetchSleeps = async () => {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - daysRange + 1);
        const toISO = d => d.toISOString().slice(0,10);
        const res = await sleepsAPI.getLatestSleeps({ limit: Math.max(1, daysRange), startDate: toISO(start), endDate: toISO(end) }).catch(() => null);
        let sleepsArr = [];
        if (!res) sleepsArr = [];
        else if (Array.isArray(res.sleeps)) sleepsArr = res.sleeps;
        else if (Array.isArray(res)) sleepsArr = res;
        else if (res.data && Array.isArray(res.data)) sleepsArr = res.data;
        const set = new Set();
        for (const s of (sleepsArr || [])) {
          const raw = s.day ?? s.date ?? (s.sleep_start ? s.sleep_start : null);
          const localKey = dayStartMs(raw);
          const utcKey = dayStartMsUTC(raw);
          if (localKey) set.add(String(localKey));
          if (utcKey) set.add(String(utcKey));
        }
        setDaysWithSleep(set);
      } catch (e) {
        console.warn('Failed to fetch sleeps for marking', e);
        setDaysWithSleep(new Set());
      }
    };
    fetchSleeps();
  }, [daysRange]);

  useEffect(() => {
    if (!showCorr) return;
    const fetchCorr = async () => {
      try {
        setCorrLoading(true);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - corrRange + 1);
        const toISO = d => d.toISOString().slice(0,10);
        const res = await journalAPI.getCorrelations(toISO(start), toISO(end), corrMethod, { min_abs: corrMinAbs });
        setCorr(res);
      } catch (e) {
        console.warn('Correlation fetch failed', e);
        setCorr(null);
      } finally {
        setCorrLoading(false);
      }
    };
    fetchCorr();
  }, [showCorr, corrRange, corrMethod, corrMinAbs]);

  const recoveryMap = useMemo(() => {
    const m = new Map();
    recovery.forEach(r => m.set(r.day, r.recovery_score));
    return m;
  }, [recovery]);

  // Simple sparkline component (SVG) for small inline charts in metric cards
  const Sparkline = ({ data = [], width = 120, height = 28, stroke = '#60a5fa' }) => {
    const vals = (data || []).map(v => (v == null || isNaN(v) ? null : Number(v)));
    const cleaned = vals.filter(v => v != null);
    if (!cleaned.length) {
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <rect width={width} height={height} fill="transparent" />
        </svg>
      );
    }
    const min = Math.min(...cleaned);
    const max = Math.max(...cleaned);
    const range = max - min || 1;
    const step = width / Math.max(1, data.length - 1);
    const points = vals.map((v, i) => {
      if (v == null) return null;
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).filter(Boolean).join(' ');
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Metric card component
  const MetricCard = ({ title, value, unit, delta, sparkData, color='#60a5fa' }) => (
    <div className="metric-card" style={{ background:'rgba(255,255,255,0.03)', padding:12, borderRadius:10, minWidth:160, flex:1, border:'1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <div>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{title}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--card-text,#e2e8f0)' }}>{value}{unit ? <span style={{ fontSize:12, marginLeft:6 }}>{unit}</span> : null}</div>
        </div>
        <div style={{ width:120 }}>
          <Sparkline data={sparkData} stroke={color} />
        </div>
      </div>
      <div style={{ marginTop:8, fontSize:12, color:'#94a3b8' }}>{delta != null ? (delta >= 0 ? (<span style={{ color:'#34d399' }}>▲ {Math.round(delta)}%</span>) : (<span style={{ color:'#fb7185' }}>▼ {Math.abs(Math.round(delta))}%</span>)) : <span>-</span>}</div>
    </div>
  );

  // derive series and simple stats for metric cards
  const metrics = useMemo(() => {
    const sorted = [...rows].sort((a,b) => new Date(String(a.day)) - new Date(String(b.day)));
    const sleepSeries = sorted.map(r => r.sleep_score == null ? null : Number(r.sleep_score));
    const stepsSeries = sorted.map(r => r.steps == null ? null : Number(r.steps));
    const rhrSeries = sorted.map(r => r.rhr == null ? null : Number(r.rhr));
    const recoverySeries = sorted.map(r => {
      const key = String(r.day);
      return recoveryMap.get(key) == null ? null : Number(recoveryMap.get(key));
    });

    const calc = (arr) => {
      const cleaned = arr.filter(v => v != null && !Number.isNaN(v));
      if (!cleaned.length) return { last: null, change: null };
      const last = cleaned[cleaned.length-1];
      const half = Math.max(1, Math.floor(cleaned.length/2));
      const recent = cleaned.slice(-half);
      const prev = cleaned.slice(0, Math.max(0, cleaned.length - half));
      const avg = a => a.reduce((s,x)=>s+x,0)/a.length;
      const recentAvg = avg(recent);
      const prevAvg = prev.length ? avg(prev) : recentAvg;
      const change = prevAvg ? ((recentAvg - prevAvg)/Math.abs(prevAvg))*100 : null;
      return { last, change };
    };

    const sleep = calc(sleepSeries);
    const steps = calc(stepsSeries);
    const rhr = calc(rhrSeries);
    const recoveryM = calc(recoverySeries);

    return {
      sleepSeries, stepsSeries, rhrSeries, recoverySeries,
      sleep, steps, rhr, recovery: recoveryM
    };
  }, [rows, recoveryMap]);

  if (loading && rows.length === 0) return <LoadingSpinner message="Loading daily summaries..." />;
  if (error && rows.length === 0) return <ErrorMessage message={error} />;

  return (
    <div className="sleep-page fade-in">
      <div className="page-header" style={{ marginTop: 8, marginBottom: 24 }}>
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">📅</span>
            Days
          </h1>
          <p className="page-subtitle">Daily summaries (from garmin_daily_summaries)</p>
        </div>
        <div className="header-controls items-center">
          <RangeControls days={daysRange} onChangeDays={setDaysRange} />
        </div>
      </div>

      {/* Metrics grid inserted above the summaries list */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <MetricCard
            title="Sleep Score"
            value={metrics?.sleep?.last != null ? Math.round(metrics.sleep.last) : '-'}
            unit="pts"
            delta={metrics?.sleep?.change}
            sparkData={metrics?.sleepSeries}
            color="#60a5fa"
          />
          <MetricCard
            title="Steps"
            value={metrics?.steps?.last != null ? fmtNumber(Math.round(metrics.steps.last)) : '-'}
            unit=""
            delta={metrics?.steps?.change}
            sparkData={metrics?.stepsSeries}
            color="#f59e0b"
          />
          <MetricCard
            title="Resting HR"
            value={metrics?.rhr?.last != null ? Math.round(metrics.rhr.last) : '-'}
            unit="bpm"
            delta={metrics?.rhr?.change}
            sparkData={metrics?.rhrSeries}
            color="#f97316"
          />
          <MetricCard
            title="Recovery"
            value={metrics?.recovery?.last != null ? Math.round(metrics.recovery.last) : '-'}
            unit=""
            delta={metrics?.recovery?.change}
            sparkData={metrics?.recoverySeries}
            color="#34d399"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden card" style={{ padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:12, flexWrap:'wrap' }}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white sleep-section-title" style={{ margin:0 }}>Daily Summaries</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={() => setShowCorr(s => !s)} className="liquid-button" style={{ padding:'6px 12px', fontSize:12 }}>{showCorr ? 'Hide Correlations' : 'Show Correlations'}</button>
            {loading && <span style={{ fontSize:12, color:'#64748b' }}>Loading…</span>}
          </div>
        </div>
        {rows.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-400">No daily summaries found</div>
        ) : (
          <div style={{ display:'grid', gap:14 }}>
            {rows.map(r => {
              const dayKey = String(r.day);
              const rec = recoveryMap.get(dayKey) ?? null;
              return (
                <Link key={dayKey} to={`/days/${encodeURIComponent(dayKey)}`} style={{ textDecoration:'none' }}>
                  <DayCard day={formatDate(r.day)} journal={{}} recoveryScore={rec}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))', gap:8, fontSize:12, color:'#e2e8f0' }}>
                      <div><span style={{ color:'#94a3b8' }}>Sleep</span><div>{r.sleep_score ?? '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>Stress</span><div>{r.avg_stress != null ? Math.round(r.avg_stress) : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>RHR</span><div>{r.rhr != null ? Math.round(r.rhr) : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>Resp</span><div>{(r.resp_avg != null || r.resp_max != null) ? (r.resp_avg != null && r.resp_max != null ? `${Number(r.resp_avg).toFixed(1)} / ${r.resp_max}` : (r.resp_avg != null ? Number(r.resp_avg).toFixed(1) : r.resp_max)) : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>TIB</span><div>{r.tib_minutes != null ? formatMinutesToHhMm(r.tib_minutes) : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>Steps</span><div>{r.steps != null ? fmtNumber(r.steps) : '-'}</div></div>
                    </div>
                    {/* badge for missing sleep */}
                    {(() => {
                      const localKey = dayStartMs(r.day);
                      const utcKey = dayStartMsUTC(r.day);
                      if (!daysWithSleep || !daysWithSleep.size) return null;
                      const hasLocal = localKey && daysWithSleep.has(String(localKey));
                      const hasUtc = utcKey && daysWithSleep.has(String(utcKey));
                      if (!hasLocal && !hasUtc) {
                        return <div style={{ marginTop:8, color:'#f97316', fontSize:12, fontWeight:700 }}>No sleep data</div>;
                      }
                      return null;
                    })()}
                  </DayCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showCorr && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden card" style={{ padding:16, marginTop:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <h3 style={{ margin:0, fontSize:16 }} className="text-gray-900 dark:text-white">Correlations ({corrMethod})</h3>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
              <label style={{ fontSize:12, color:'#94a3b8' }}>Method
                <select value={corrMethod} onChange={e=> setCorrMethod(e.target.value)} style={{ marginLeft:6, background:'#1e293b', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, padding:'4px 6px' }}>
                  <option value="pearson">Pearson</option>
                  <option value="spearman">Spearman</option>
                </select>
              </label>
              <label style={{ fontSize:12, color:'#94a3b8' }}>Range
                <select value={corrRange} onChange={e=> setCorrRange(Number(e.target.value))} style={{ marginLeft:6, background:'#1e293b', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, padding:'4px 6px' }}>
                  {[14,30,60,90].map(n => <option key={n} value={n}>{n}d</option>)}
                </select>
              </label>
              <label style={{ fontSize:12, color:'#94a3b8' }}>Min |r|
                <input type="number" step="0.05" min={0} max={1} value={corrMinAbs} onChange={e=> setCorrMinAbs(Number(e.target.value))} style={{ width:60, marginLeft:6, background:'#1e293b', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, padding:'4px 6px' }} />
              </label>
              <div style={{ display:'flex', gap:6, fontSize:11, alignItems:'center' }}>
                {['ratings','metrics','flags'].map(cat => (
                  <label key={cat} style={{ display:'flex', gap:4, alignItems:'center', background:'#1e293b', padding:'4px 6px', borderRadius:6, border:'1px solid #334155', cursor:'pointer' }}>
                    <input type="checkbox" checked={corrCategories[cat]} onChange={()=> setCorrCategories(prev => ({ ...prev, [cat]: !prev[cat] }))} />
                    <span style={{ textTransform:'capitalize' }}>{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {corrLoading && <div style={{ fontSize:12, color:'#64748b', marginTop:8 }}>Loading correlations…</div>}
          {!corrLoading && corr && corr.pairs && corr.pairs.length > 0 ? (
            <div style={{ marginTop:12, display:'grid', gap:16 }}>
              <div style={{ overflowX:'auto' }}>
                <CorrelationHeatmap matrix={corr.matrix} samples={corr.samples_per_column} pairs={corr.pairs} categories={corr.categories} activeCats={corrCategories} />
              </div>
              <TopCorrelationPairs pairs={corr.pairs} categories={corr.categories} activeCats={corrCategories} />
            </div>
          ) : (!corrLoading && showCorr && <div style={{ fontSize:12, color:'#94a3b8', marginTop:8 }}>No correlation data.</div>)}
        </div>
      )}

      <style jsx>{`
        .sleep-page { max-width: 1200px; margin: 0 auto; padding: 24px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        .dark .page-header { border-bottom-color: #334155; }
        .header-content { flex: 1; }
        .page-title { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #1e293b; margin: 0; }
        .dark .page-title { color: #f1f5f9; }
        .title-icon { font-size: 1.75rem; }
        .page-subtitle { color: #64748b; margin: 6px 0 0 0; font-size: 0.95rem; }
        .dark .page-subtitle { color: #94a3b8; }
        .header-controls { display: flex; gap: 12px; align-items: center; }
        .card { border-radius: 12px; }
        .sleep-section-title { color: #1e293b; }
        .dark .sleep-section-title { color: #ffffff !important; }
        /* control pill moved to shared RangeControls */
      `}</style>
    </div>
  );
};

export default Days;
