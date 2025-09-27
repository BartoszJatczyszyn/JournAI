import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { healthAPI2 } from '../services';

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

const getScoreCategory = (score) => {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Number(score);
  if (s >= 80) return 'excellent';
  if (s >= 70) return 'good';
  if (s >= 60) return 'fair';
  return 'poor';
};

const getScoreBadgeClass = (score) => {
  // Keep background hints but force white text for visibility as requested
  if (score == null) return 'bg-gray-200 dark:bg-gray-700 text-white';
  if (score >= 80) return 'bg-green-600 dark:bg-green-900 text-white';
  if (score >= 70) return 'bg-blue-600 dark:bg-blue-900 text-white';
  if (score >= 60) return 'bg-yellow-600 dark:bg-yellow-900 text-white';
  return 'bg-red-600 dark:bg-red-900 text-white';
};

const Days = () => {
  const [daysRange, setDaysRange] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden card">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white sleep-section-title">Daily Summaries</h3>
          {loading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {rows.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">No daily summaries found</p>
            </div>
          ) : (
            <table className="min-w-full table-auto sleep-table">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Day</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Sleep Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Avg Stress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">RHR</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Resp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Time in bed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Steps</th>
                    </tr>
                  </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r) => {
                  const scoreCat = getScoreCategory(r.sleep_score);
                  const dayKey = String(r.day);
                  return (
                  <tr key={dayKey} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${scoreCat ? `score-${scoreCat}` : ''}`}>
                    <td colSpan={7} className="p-0">
                      <Link to={`/days/${encodeURIComponent(dayKey)}`} className="block w-full p-4 hover:opacity-95" style={{ textDecoration: 'none' }}>
                        <div className="grid" style={{ gridTemplateColumns: '1fr 160px 120px 80px 80px 140px 100px', alignItems: 'center' }}>
                          <div className="text-sm text-white">{formatDate(r.day)}</div>
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBadgeClass(r.sleep_score)}`}>
                              {r.sleep_score ?? '-'}
                            </span>
                          </div>
                          <div className="text-sm text-white">{r.avg_stress != null ? Math.round(r.avg_stress) : '-'}</div>
                          <div className="text-sm text-white">{r.rhr != null ? Math.round(r.rhr) : '-'}</div>
                          <div className="text-sm text-white">{r.resp != null ? r.resp : '-'}</div>
                          <div className="text-sm text-white">{r.tib_minutes != null ? formatMinutesToHhMm(r.tib_minutes) : '-'}</div>
                          <div className="text-sm text-white">{r.steps != null ? fmtNumber(r.steps) : '-'}</div>
                        </div>
                      </Link>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
        .sleep-table thead { background: #0f172a; }
        .sleep-table thead th { color: #ffffff; }
        .sleep-section-title { color: #1e293b; }
        .dark .sleep-section-title { color: #ffffff !important; }
        .sleep-table tbody td { color: #ffffff; }
        .liquid-control { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 9999px; background: rgba(255,255,255,0.06); color: #f8fafc; backdrop-filter: blur(6px) saturate(120%); -webkit-backdrop-filter: blur(6px) saturate(120%); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 18px rgba(2,6,23,0.5); }
        .page-size-select { appearance: none; -webkit-appearance: none; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); color: #f8fafc; border: 1px solid rgba(255,255,255,0.08); }
      `}</style>
    </div>
  );
};

export default Days;
