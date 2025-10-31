import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sleepsAPI } from '../../sleep/api';
import WeeklyTrendsSleep from '../components/WeeklyTrends';
import { RangeControls } from 'shared/ui';

const Sleeps = () => {
  const [sleeps, setSleeps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [daysRange, setDaysRange] = useState(30);
  const [total, setTotal] = useState(null);

  const loadSleeps = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // compute date range like in Days.js
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - daysRange + 1);
      const toISO = (d) => d.toISOString().slice(0,10);
      const fetchLimit = Math.max(28, daysRange + 7); // small cushion for multi-sleeps

      const data = await sleepsAPI.getLatestSleeps({
        limit: fetchLimit,
        startDate: toISO(start),
        endDate: toISO(end),
      });

      if (data && typeof data === 'object' && Array.isArray(data.sleeps)) {
        console.log('Setting sleeps:', data.sleeps.length, 'items');
        setSleeps(data.sleeps);
        setTotal(data.total_count || data.count || null);
      } else {
        console.error('Invalid data structure:', data);
        throw new Error('No sleep data received - invalid response format');
      }
    } catch (e) {
      console.error('Error loading sleeps:', e);
      setError(e.message || 'Failed to load sleeps');
    } finally {
      setLoading(false);
    }
  }, [daysRange]);

  useEffect(() => {
    loadSleeps();
  }, [loadSleeps]);

  // Format duration as H:MM. Accepts seconds by default or minutes when unit='minutes'.
  const formatDuration = (value, unit = 'seconds') => {
    if (value == null) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    let minutes;
    if (unit === 'seconds') minutes = Math.round(num / 60);
    else if (unit === 'minutes') minutes = Math.round(num);
    else minutes = Math.round(num);
    if (!Number.isFinite(minutes)) return '-';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${hours}:${String(mins).padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
  // Unified mapping:
  // Poor (0-59) -> red
  // Fair (60-69) -> yellow
  // Good (70-79) -> blue
  // Excellent (80-100) -> green
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-blue-500 dark:text-blue-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
  };
  // reference to avoid unused-var ESLint warning
  void getScoreColor;

  const getScoreBadgeClass = (score) => {
    if (score == null) return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    if (score >= 80) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    if (score >= 70) return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  };

  const getScoreCategory = (score) => {
    if (score == null || Number.isNaN(Number(score))) return null;
    const s = Number(score);
    if (s >= 80) return 'excellent';
    if (s >= 70) return 'good';
    if (s >= 60) return 'fair';
    return 'poor';
  };

  const calculateEfficiency = (sleep) => {
    if (sleep.efficiency_pct != null) return Math.round(sleep.efficiency_pct);
    
    const durSec = sleep.sleep_duration_seconds || (sleep.duration_min * 60);
    if (!durSec) return null;
    
    if (sleep.sleep_start && sleep.sleep_end) {
      const timeInBed = (new Date(sleep.sleep_end) - new Date(sleep.sleep_start)) / 1000;
      if (timeInBed > 0) return Math.round((durSec / timeInBed) * 100);
    }
    
    return null;
  };

  const getLastPhaseLabel = (sleep) => {
    if (!sleep) return null;
    // Prefer explicit label fields from backend
    if (sleep.last_sleep_phase_label) return sleep.last_sleep_phase_label;
    if (sleep.last_pre_wake_phase_label) return sleep.last_pre_wake_phase_label;

    // Numeric encoded phase fields (1=Deep,2=Light,3=REM,4=Awake)
    const mapNum = (n) => {
      const v = Number(n);
      if (Number.isNaN(v)) return null;
      if (v === 1) return 'Deep';
      if (v === 2) return 'Light';
      if (v === 3) return 'REM';
      if (v === 4) return 'Awake';
      return null;
    };
    if (sleep.last_pre_wake_phase != null) {
      const m = mapNum(sleep.last_pre_wake_phase);
      if (m) return m;
    }
    if (sleep.last_sleep_phase != null) {
      // could be string label or numeric
      const asStr = String(sleep.last_sleep_phase);
      const lowered = asStr.toLowerCase();
      if (lowered.includes('deep')) return 'Deep';
      if (lowered.includes('rem')) return 'REM';
      if (lowered.includes('light')) return 'Light';
      if (lowered.includes('awake') || lowered.includes('wake')) return 'Awake';
      const m2 = mapNum(asStr);
      if (m2) return m2;
    }

    // Last resort: inspect embedded event arrays (sleep_events / events / garmin_sleep_events)
    const evs = Array.isArray(sleep.sleep_events) ? sleep.sleep_events
      : Array.isArray(sleep.events) ? sleep.events
      : Array.isArray(sleep.garmin_sleep_events) ? sleep.garmin_sleep_events
      : null;
    if (evs && evs.length) {
      const toMs = (e) => e && e.timestamp ? new Date(e.timestamp).getTime() : (e && e.ts ? new Date(e.ts).getTime() : (typeof e.t === 'number' ? e.t : null));
      const mapped = evs
        .map(e => ({ t: toMs(e), name: String(e.event || e.stage || e.type || '').toLowerCase() }))
        .filter(e => typeof e.t === 'number')
        .sort((a, b) => a.t - b.t);
      if (mapped.length) {
        let last = mapped[mapped.length - 1];
        if ((last.name || '').includes('awake') || (last.name || '').includes('wake')) {
          if (mapped.length >= 2) last = mapped[mapped.length - 2];
        }
        if (last && last.name) {
          if (last.name.includes('deep')) return 'Deep';
          if (last.name.includes('rem')) return 'REM';
          if (last.name.includes('light')) return 'Light';
          if (last.name.includes('awake') || last.name.includes('wake')) return 'Awake';
        }
      }
    }

    return null;
  };

  if (loading && sleeps.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="sleep-page fade-in">
      <div className="page-header" style={{ marginTop: 8, marginBottom: 24 }}>
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">😴</span>
            Sleep Sessions
          </h1>
          <p className="page-subtitle">Review your recent sleep sessions and patterns</p>
        </div>
        <div className="header-controls items-center">
          <div className="liquid-badge mr-4" title="Total sessions">
            <div className="sessions-count text-sm">
              {total != null ? `${total} sessions` : `${sleeps.length} shown`}
            </div>
          </div>
          <RangeControls days={daysRange} onChangeDays={setDaysRange} />
        </div>
  </div>

  {/* Weekly Trends */}
  <div className="mb-6">
    {/* Show number of weeks based on selected range (approx weeks) */}
    <WeeklyTrendsSleep pageSize={Math.max(1, Math.round(daysRange / 7))} />
  </div>

  {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-red-800 dark:text-red-200 font-medium">Error Loading Sleep Data</h3>
                <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
              </div>
            </div>
            <button
              onClick={loadSleeps}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

  {/* Sleep Sessions Table */}
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden card">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white sleep-section-title">Latest Sleep Sessions</h3>
            {loading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {sleeps.length === 0 && !loading ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No sleep sessions found</p>
              </div>
            ) : (
              <table className="min-w-full table-auto sleep-table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">End Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Efficiency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Deep</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Light</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">REM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Awake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Phase</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sleeps.map((sleep) => {
                    const scoreCat = getScoreCategory(sleep.sleep_score);
                    const sleepKey = sleep.id ?? sleep.sleep_id ?? sleep.sleepId ?? `${sleep.day}-${sleep.sleep_start}`;
                    const sleepLinkId = sleep.id ?? sleep.sleep_id ?? sleep.sleepId ?? '';
                    return (
                      <tr key={sleepKey} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${scoreCat ? `score-${scoreCat}` : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link 
                            to={`/sleep/${sleepLinkId}`} 
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            {sleep.sleep_start ? new Date(sleep.sleep_start).toLocaleString() : '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {sleep.sleep_end ? new Date(sleep.sleep_end).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDuration(sleep.sleep_duration_seconds) || formatDuration(sleep.duration_min, 'minutes')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {calculateEfficiency(sleep) ? `${calculateEfficiency(sleep)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBadgeClass(sleep.sleep_score)}`}>
                            {sleep.sleep_score ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDuration(sleep.deep_sleep_seconds)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDuration(sleep.light_sleep_seconds)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDuration(sleep.rem_sleep_seconds)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDuration(sleep.awake_seconds)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {getLastPhaseLabel(sleep) ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

  {/* Pagination */}
        {/* Pagination removed in favor of range selection */}
  <style>{`
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
        @media (max-width: 768px) { .page-header { flex-direction: column; gap: 12px; } }
    /* Table colorization: white text for defaults and per-column header accents */
    .sleep-table thead { background: #0f172a; }
    .sleep-table thead th { color: #ffffff; }
  /* Ensure the section title is always white in dark mode for visibility */
  .sleep-section-title { color: #1e293b; }
  .dark .sleep-section-title { color: #ffffff !important; }
    /* Default body cell color (when no score-based row class is present) */
    .sleep-table tbody td { color: #ffffff; }
    /* Liquid glass badge for session count and controls */
    .liquid-badge, .liquid-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.06);
      color: #f8fafc;
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 6px 18px rgba(2,6,23,0.5);
    }
    /* make it slightly brighter in dark mode */
    .dark .liquid-badge, .dark .liquid-control {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.12);
      color: #ffffff;
    }
    /* Liquid style for pagination buttons */
    .liquid-button {
      padding: 8px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.06);
      color: #ffffff;
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      box-shadow: 0 8px 20px rgba(2,6,23,0.45);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .liquid-button:hover { transform: translateY(-2px); background: rgba(255,255,255,0.09); }
    .liquid-button.prev { border-color: rgba(255,255,255,0.06); }
    .liquid-button.next { border-color: rgba(59,130,246,0.9); background: rgba(59,130,246,0.12); }
    .liquid-button:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
    /* Increase spacing inside table cells for readability */
    .sleep-table thead th, .sleep-table tbody td { padding: 16px 20px !important; }
  /* Let the start-time link inherit the cell/row color so it matches other cells */
  .sleep-table tbody td:nth-child(1) a { color: inherit !important; text-decoration: none; }

  /* Column header accents only (body cells should inherit row coloring) */
  .sleep-table thead th:nth-child(3) { color: #10b981; } /* Duration - green */
  .sleep-table thead th:nth-child(4) { color: #f59e0b; } /* Efficiency - amber */
  .sleep-table thead th:nth-child(5) { color: #3b82f6; } /* Score - blue */
  .sleep-table thead th:nth-child(6) { color: #8b5cf6; } /* Deep - purple */
  .sleep-table thead th:nth-child(7) { color: #22c55e; } /* Light - green */
  .sleep-table thead th:nth-child(8) { color: #06b6d4; } /* REM - cyan */
  .sleep-table thead th:nth-child(9) { color: #ef4444; } /* Awake - red */
  .sleep-table thead th:nth-child(10) { color: #94a3b8; } /* Last Phase - muted */

  /* Score category row text coloring */
  .sleep-table tbody tr.score-poor td { color: #ef4444; } /* red */
  .sleep-table tbody tr.score-fair td { color: #f59e0b; } /* amber */
  .sleep-table tbody tr.score-good td { color: #3b82f6; } /* blue */
  .sleep-table tbody tr.score-excellent td { color: #10b981; } /* green */

        /* On small screens reduce padding so colors remain visible */
        @media (max-width: 640px) {
          .sleep-table thead th, .sleep-table tbody td { padding-left: 8px; padding-right: 8px; padding-top: 8px; padding-bottom: 8px !important; }
        }
      `}</style>
    </div>
  );
};

export default Sleeps;