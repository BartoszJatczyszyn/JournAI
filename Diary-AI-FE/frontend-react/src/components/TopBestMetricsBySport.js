import React from 'react';
import { activitiesAPI } from 'features/activities/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { formatPaceMinPerKm, formatDuration } from '../utils/timeUtils';

// Sports to render and their default ranking metric
const SPORT_CONFIG = {
  running: { label: 'Running', sortBy: 'pace', asc: true, minDistanceKm: 3 },
  walking: { label: 'Walking', sortBy: 'distance', asc: false },
  swimming: { label: 'Swimming', sortBy: 'distance', asc: false },
  cycling: { label: 'Cycling', sortBy: 'distance', asc: false },
  hiking: { label: 'Hiking', sortBy: 'distance', asc: false },
  fitness_equipment: { label: 'Fitness Equipment', sortBy: 'duration', asc: false },
};

const METRIC_OPTIONS = [
  { value: 'distance', label: 'Distance (km)', defaultAsc: false },
  { value: 'duration', label: 'Duration (min)', defaultAsc: false },
  { value: 'pace', label: 'Avg Pace (min/km)', defaultAsc: true }, // lower is better
  { value: 'calories', label: 'Calories', defaultAsc: false },
  { value: 'avg_hr', label: 'Avg HR (bpm)', defaultAsc: false },
];
const DEFAULT_ASC_FOR = (metric) => (metric === 'pace');

// Normalize/derive fields from raw activity
function normalizeActivity(a) {
  const out = { ...a };
  // distance_km
  if (out.distance_km == null && out.distance != null) {
    try { out.distance_km = Number(out.distance) / 1000.0; } catch { /* ignore */ }
  }
  // duration_min
  if (out.duration_min == null && out.elapsed_time != null) {
    try { out.duration_min = Number(out.elapsed_time) / 60.0; } catch { /* ignore */ }
  }
  // avg_pace (min/km)
  if (out.avg_pace == null || out.avg_pace === '') {
    try {
      if (out.avg_speed != null && Number(out.avg_speed) > 0) {
        // avg_speed is km/h
        out.avg_pace = 60.0 / Number(out.avg_speed);
      } else if (out.distance_km != null && out.distance_km > 0 && out.duration_min != null) {
        out.avg_pace = Number(out.duration_min) / Number(out.distance_km);
      }
    } catch {/* ignore */}
  }
  return out;
}

function normalizeSportKey(a) {
  const parts = [];
  const tryPush = (v) => { if (v != null) parts.push(String(v)); };
  tryPush(a.sport); tryPush(a.sub_sport); tryPush(a.name); tryPush(a.description);
  if (Array.isArray(a.tags)) parts.push(...a.tags.map(String));
  const s = parts.join(' | ').toLowerCase();
  if (!s) return null;
  if (s.includes('run')) return 'running';
  if (s.includes('walk')) return 'walking';
  if (s.includes('swim')) return 'swimming';
  if (s.includes('cycle') || s.includes('bike') || s.includes('ride')) return 'cycling';
  if (s.includes('hike') || s.includes('trek') || s.includes('trail')) return 'hiking';
  if (s.includes('fitness_equipment') || s.includes('fitness equipment') || s.includes('fitness-equipment') || s.includes('gym') || s.includes('strength') || s.includes('workout')) return 'fitness_equipment';
  return (a.sport || '').toLowerCase() || null;
}

function rankActivities(activities, sportKey, sortBy, asc) {
  const cfg = SPORT_CONFIG[sportKey] || { sortBy: 'distance', asc: false };
  const items = activities
    .map(normalizeActivity)
    .filter(a => {
      // Ensure the chosen metric exists for this activity
      const hasMetric = (metric) => {
        if (metric === 'pace') return a.avg_pace != null && Number.isFinite(Number(a.avg_pace));
        if (metric === 'duration') return a.duration_min != null && Number.isFinite(Number(a.duration_min));
        if (metric === 'calories') return a.calories != null && Number.isFinite(Number(a.calories));
        if (metric === 'avg_hr') return a.avg_hr != null && Number.isFinite(Number(a.avg_hr));
        // distance
        return a.distance_km != null && Number.isFinite(Number(a.distance_km));
      };

      // Per-sport sanity filters
      if (sportKey === 'running') {
        if (cfg.minDistanceKm && (!a.distance_km || a.distance_km < cfg.minDistanceKm)) return false;
        // Only require pace presence when sorting by pace
        if (sortBy === 'pace' && !hasMetric('pace')) return false;
      }
      if (sportKey === 'swimming') {
        // Distance > 0 constraint only when sorting by distance; otherwise allow other metrics
        if (sortBy === 'distance' && !(a.distance_km > 0)) return false;
      }
      if (sportKey === 'fitness_equipment') {
        // Prefer having the chosen metric; if none, drop
        if (!hasMetric(sortBy)) return false;
      }

      // Finally, drop rows without the chosen metric
      if (!hasMetric(sortBy)) return false;
      return true;
    });

  const valueOf = (a) => {
    switch (sortBy || cfg.sortBy) {
      case 'pace': return a.avg_pace != null ? Number(a.avg_pace) : Infinity; // lower is better
      case 'duration': return a.duration_min != null ? Number(a.duration_min) : -Infinity;
      case 'calories': return a.calories != null ? Number(a.calories) : -Infinity;
        case 'avg_hr': return a.avg_hr != null ? Number(a.avg_hr) : -Infinity;
      case 'distance':
      default: return a.distance_km != null ? Number(a.distance_km) : -Infinity;
    }
  };

  items.sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    // Ascending for pace (or when explicitly requested), descending otherwise
    const useAsc = (typeof asc === 'boolean') ? asc : (cfg.asc === true);
    return useAsc ? (va - vb) : (vb - va);
  });

  // Return fully sorted list; slicing to Top N happens in the renderer
  return items;
}

const Cell = ({ children, title }) => (
  <td className="py-2 px-3 whitespace-nowrap" title={title || ''}>{children}</td>
);

export default function TopBestMetricsBySport({ limit = 2000, defaultTopN = 5 }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [activities, setActivities] = React.useState([]);
  const [sortPrefs, setSortPrefs] = React.useState(() => {
    try {
      const saved = localStorage.getItem('bestMetricsSortPrefs');
      if (saved) {
        const parsed = JSON.parse(saved);
        // ensure defaults for all sports
        const out = {};
        Object.keys(SPORT_CONFIG).forEach(k => {
          const defMetric = SPORT_CONFIG[k].sortBy;
          const defAsc = SPORT_CONFIG[k].asc;
          const row = parsed?.[k] || {};
          const sb = row.sortBy || defMetric;
          const asc = (typeof row.asc === 'boolean') ? row.asc : (DEFAULT_ASC_FOR(sb) ?? defAsc);
          out[k] = { sortBy: sb, asc };
        });
        return out;
      }
    } catch {/* ignore */}
    const init = {};
    Object.keys(SPORT_CONFIG).forEach(k => {
      const sb = SPORT_CONFIG[k].sortBy;
      init[k] = { sortBy: sb, asc: SPORT_CONFIG[k].asc ?? DEFAULT_ASC_FOR(sb) };
    });
    return init;
  });
  const [topN, setTopN] = React.useState(() => {
    try {
      const saved = localStorage.getItem('bestMetricsTopN');
      const v = Number(saved);
      if (Number.isFinite(v) && v >= 1 && v <= 200) return v;
    } catch {/* ignore */}
    return Number.isFinite(defaultTopN) && defaultTopN > 0 ? defaultTopN : 5;
  });

  React.useEffect(() => {
    // If parent provides a new default, adopt it only when user hasn't set a custom value
    if (Number.isFinite(defaultTopN) && defaultTopN > 0) {
      setTopN(prev => (prev == null ? Number(defaultTopN) : prev));
    }
  }, [defaultTopN]);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await activitiesAPI.getLatestActivities(limit);
        if (!mounted) return;
        setActivities(Array.isArray(res?.activities) ? res.activities : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load activities');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [limit]);

  if (loading && activities.length === 0) return <LoadingSpinner message="Loading best metrics..." />;
  if (error && activities.length === 0) return <ErrorMessage message={error} />;

  // Group by normalized sport keys we care about
  const bySport = Object.keys(SPORT_CONFIG).reduce((acc, key) => { acc[key] = []; return acc; }, {});
  for (const a of activities) {
    const key = normalizeSportKey(a);
    if (key && bySport[key]) bySport[key].push(a);
  }

  const renderTable = (sportKey) => {
    const n = Math.max(1, Math.min(200, Number(topN) || 5));
    const pref = sortPrefs[sportKey] || SPORT_CONFIG[sportKey];
    const rows = rankActivities(bySport[sportKey] || [], sportKey, pref.sortBy, pref.asc).slice(0, n);
    const cfg = SPORT_CONFIG[sportKey];
    const handleChangeSortBy = (e) => {
      const metric = e.target.value;
      setSortPrefs(prev => {
        const next = { ...prev, [sportKey]: { sortBy: metric, asc: DEFAULT_ASC_FOR(metric) } };
        try { localStorage.setItem('bestMetricsSortPrefs', JSON.stringify(next)); } catch {/* ignore */}
        return next;
      });
    };
    const toggleAsc = () => {
      setSortPrefs(prev => {
        const curr = prev[sportKey] || { sortBy: cfg.sortBy, asc: cfg.asc };
        const next = { ...prev, [sportKey]: { ...curr, asc: !curr.asc } };
        try { localStorage.setItem('bestMetricsSortPrefs', JSON.stringify(next)); } catch {/* ignore */}
        return next;
      });
    };
    return (
      <div key={sportKey} className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">{cfg.label} — Top {n}</h3>
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span>Sorted by</span>
            <select className="select select-xs" value={pref.sortBy} onChange={handleChangeSortBy}>
              {METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button type="button" className="btn btn-xs" onClick={toggleAsc} title={pref.asc ? 'Ascending' : 'Descending'}>
              {pref.asc ? '▲' : '▼'}
            </button>
          </div>
        </div>
        <div className="card-content overflow-x-auto">
          {rows.length === 0 ? (
            <div className="text-sm text-gray-500">No data</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50 dark:bg-gray-800/40">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Distance</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Avg Pace</th>
                  <th className="py-2 px-3">Avg HR</th>
                  <th className="py-2 px-3">Calories</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const d = a.start_time ? new Date(a.start_time) : null;
                  const dateStr = d && !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '-';
                  const dist = a.distance_km != null ? `${Number(a.distance_km).toFixed(3)} km` : '-';
                  const dur = a.duration_min != null ? formatDuration(a.duration_min, 'minutes') : '-';
                  const paceVal = a.avg_pace != null && Number.isFinite(Number(a.avg_pace)) ? Number(a.avg_pace) : null;
                  const paceStr = paceVal != null ? `${formatPaceMinPerKm(paceVal)} min/km` : '-';
                  const hr = a.avg_hr != null ? Number(a.avg_hr).toFixed(0) : '-';
                  const cal = a.calories != null ? Number(a.calories).toFixed(0) : '-';
                  const paceHighlight = pref.sortBy === 'pace' && paceVal != null;
                  const distHighlight = pref.sortBy === 'distance' && a.distance_km != null;
                  const durHighlight = pref.sortBy === 'duration' && a.duration_min != null;
                  const calHighlight = pref.sortBy === 'calories' && a.calories != null;
                  const hrHighlight = pref.sortBy === 'avg_hr' && a.avg_hr != null;
                  return (
                    <tr key={a.activity_id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Cell>{dateStr}</Cell>
                      <Cell title={a.name || ''}>{a.name || 'Activity'}</Cell>
                      <Cell>
                        <span className={distHighlight ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}>{dist}</span>
                      </Cell>
                      <Cell>
                        <span className={durHighlight ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}>{dur}</span>
                      </Cell>
                      <Cell>
                        <span className={paceHighlight ? 'font-semibold text-green-600 dark:text-green-400' : ''}>{paceStr}</span>
                      </Cell>
                      <Cell>
                        <span className={hrHighlight ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{hr}</span>
                      </Cell>
                      <Cell>
                        <span className={calHighlight ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>{cal}</span>
                      </Cell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-center gap-3 text-[12px]">
        <label className="text-gray-500">Top</label>
        <select
          value={Math.max(1, Math.min(200, Number(topN) || 5))}
          onChange={(e) => {
            const v = Number(e.target.value);
            const next = Math.max(1, Math.min(200, Number.isFinite(v) ? v : 5));
            setTopN(next);
            try { localStorage.setItem('bestMetricsTopN', String(next)); } catch {/* ignore */}
          }}
          className="select select-sm"
        >
          {[5, 10, 15, 20, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-gray-400">or</span>
        <input
          type="number"
          min={1}
          max={200}
          step={1}
          value={Math.max(1, Math.min(200, Number(topN) || 5))}
          onChange={(e) => {
            const v = Number(e.target.value);
            const next = Math.max(1, Math.min(200, Number.isFinite(v) ? v : 5));
            setTopN(next);
            try { localStorage.setItem('bestMetricsTopN', String(next)); } catch {/* ignore */}
          }}
          className="input input-sm w-20"
          aria-label="Top N"
        />
      </div>
      {Object.keys(SPORT_CONFIG).map(renderTable)}
    </div>
  );
}
