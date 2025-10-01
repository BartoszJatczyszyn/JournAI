import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { healthAPI2, journalAPI } from '../services';
import DayCard from '../components/DayCard';

const formatDate = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString();
  } catch { return String(d); }
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
  const [showCorr, setShowCorr] = useState(false);
  const [corr, setCorr] = useState(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrMethod, setCorrMethod] = useState('pearson');
  const [corrRange, setCorrRange] = useState(30);
  const [corrMinAbs, setCorrMinAbs] = useState(0.0);
  const [corrCategories, setCorrCategories] = useState({ ratings: true, metrics: true, flags: true });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await healthAPI2.getHealthData(daysRange);
      // resp is expected to be an array of daily summaries
      const arr = Array.isArray(resp) ? resp : (resp?.data || []);
      // normalize day field to `day` and ensure numeric fields are numbers
      const norm = (arr || []).map(r => ({
        day: r.day ?? r.date ?? r.label ?? r.x,
        sleep_score: r.sleep_score ?? r.sleepScore ?? null,
        avg_stress: r.stress_avg ?? r.avg_sleep_stress ?? r.avg_stress ?? r.stress ?? null,
        rhr: r.rhr ?? r.avg_rhr ?? r.avg_sleep_hr ?? null,
        resp: r.respiration_rate ?? r.avg_sleep_rr ?? null,
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
  };

  useEffect(() => { load(); }, [daysRange]);

  // Fetch recovery composite scores for current range
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

  // Correlations fetch when panel visible or params change
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
          <div className="liquid-control flex items-center gap-2" title="Change range">
            <label className="text-sm" style={{ color: 'inherit' }}>Range</label>
            <select value={daysRange} onChange={(e) => setDaysRange(Number(e.target.value))} className="page-size-select">
              {[7,14,30,90].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
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
                      <div><span style={{ color:'#94a3b8' }}>Resp</span><div>{r.resp != null ? r.resp : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>TIB</span><div>{r.tib_minutes != null ? formatMinutesToHhMm(r.tib_minutes) : '-'}</div></div>
                      <div><span style={{ color:'#94a3b8' }}>Steps</span><div>{r.steps != null ? fmtNumber(r.steps) : '-'}</div></div>
                    </div>
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
        .liquid-control { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 9999px; background: rgba(255,255,255,0.06); color: #f8fafc; backdrop-filter: blur(6px) saturate(120%); -webkit-backdrop-filter: blur(6px) saturate(120%); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 18px rgba(2,6,23,0.5); }
        .page-size-select { appearance: none; -webkit-appearance: none; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); color: #f8fafc; border: 1px solid rgba(255,255,255,0.08); }
      `}</style>
    </div>
  );
};

// --- Correlation helper components ---
const CorrelationHeatmap = ({ matrix, samples, pairs, categories={}, activeCats }) => {
  if (!matrix || !Object.keys(matrix).length) return <div style={{ fontSize:12, color:'#64748b' }}>Empty</div>;
  const colsAll = Object.keys(matrix);
  const cols = colsAll.filter(c => !activeCats || activeCats[categories[c]]);
  const hiddenCount = colsAll.length - cols.length;
  const pairMap = useMemo(() => {
    const m = new Map();
    (pairs || []).forEach(p => {
      const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
      m.set(key, p);
    });
    return m;
  }, [pairs]);
  const [tooltip, setTooltip] = useState(null); // {x,y,a,b,value,n}

  const onEnter = (e, a, b) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const p = pairMap.get(key);
    const same = a === b;
    const n = same ? (samples?.[a] ?? null) : (p?.n ?? null);
    const value = matrix[a][b];
    setTooltip({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 8,
      a,
      b,
      value,
      n,
    });
  };
  const onLeave = () => setTooltip(null);

  return (
    <div style={{ display:'inline-block', border:'1px solid #1e293b', borderRadius:8, position:'relative' }}>
      <table style={{ borderCollapse:'collapse', fontSize:11 }}>
        <thead>
          <tr>
            <th style={{ padding:4, background:'#0f172a', color:'#e2e8f0' }}>↘</th>
            {cols.map(c => {
              const cat = categories[c];
              const isFlag = cat === 'flags';
              const label = isFlag ? `${c}⚑` : c;
              return <th key={c} style={{ padding:'4px 6px', background:'#0f172a', color:'#e2e8f0' }}>{label}</th>;
            })}
          </tr>
          {samples && (
            <tr>
              <th style={{ padding:4, background:'#0f172a', color:'#64748b', fontWeight:400 }}>n</th>
              {cols.map(c => <th key={c} style={{ padding:'2px 6px', background:'#0f172a', color:'#64748b', fontWeight:400 }}>{samples[c] ?? '-'}</th>)}
            </tr>
          )}
        </thead>
        <tbody>
          {cols.map(r => (
            <tr key={r}>
              <th style={{ padding:'4px 6px', textAlign:'right', background:'#0f172a', color:'#e2e8f0' }}>{r}</th>
              {cols.map(c => {
                const v = matrix[r][c];
                const val = v == null ? '' : v.toFixed(2);
                const abs = v == null ? 0 : Math.abs(v);
                const hue = v == null ? 0 : (v > 0 ? 160 : 0);
                const alpha = 0.1 + abs * 0.75;
                const bg = v == null ? '#1e293b' : `hsla(${hue},70%,40%,${alpha})`;
                return (
                  <td
                    key={c}
                    title={`${r} – ${c}: ${val || '—'}`}
                    onMouseEnter={(e)=> onEnter(e, r, c)}
                    onMouseLeave={onLeave}
                    style={{ padding:'4px 6px', background:bg, color:'#e2e8f0', textAlign:'center', minWidth:42, cursor:'crosshair' }}
                  >{val}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tooltip && (
        <div style={{ position:'absolute', left:0, top:0, transform:`translate(${tooltip.x - 80}px, ${tooltip.y - 40}px)`, background:'#0f172a', color:'#e2e8f0', padding:'8px 10px', borderRadius:8, fontSize:11, pointerEvents:'none', boxShadow:'0 4px 16px rgba(0,0,0,0.4)', maxWidth:180, zIndex:20 }}>
          <div style={{ fontWeight:600 }}>{tooltip.a === tooltip.b ? tooltip.a : `${tooltip.a} ↔ ${tooltip.b}`}</div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
              <span style={{ color:'#94a3b8' }}>r</span>
              <span>{tooltip.value == null ? '—' : tooltip.value.toFixed(4)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
              <span style={{ color:'#94a3b8' }}>n</span>
              <span>{tooltip.n ?? '—'}</span>
            </div>
        </div>
      )}
    </div>
  );
};

const TopCorrelationPairs = ({ pairs, limit=10, categories={}, activeCats }) => {
  if (!pairs || !pairs.length) return null;
  const filtered = !activeCats ? pairs : pairs.filter(p => activeCats[categories?.[p.a]] && activeCats[categories?.[p.b]]);
  const sorted = [...filtered].sort((a,b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, limit);
  return (
    <div style={{ fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>Top Correlations</div>
      <div style={{ display:'grid', gap:4 }}>
        {sorted.map(p => {
          const color = p.value >= 0 ? '#22c55e' : '#ef4444';
          return (
            <div key={`${p.a}-${p.b}`} style={{ display:'flex', justifyContent:'space-between', background:'#1e293b', padding:'4px 8px', borderRadius:6 }}>
              <span style={{ color:'#e2e8f0' }}>{p.a} – {p.b} <span style={{ color:'#64748b' }}>({p.n})</span></span>
              <span style={{ color }}>{p.value.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Days;
