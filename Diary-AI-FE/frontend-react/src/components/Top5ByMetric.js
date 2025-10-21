import React, { useMemo } from 'react';
import { useHealthData } from '../context/HealthDataContext';
import { formatPaceMinPerKm, parsePaceToMinutes, paceMinPerKm, durationToMinutes } from '../utils/timeUtils';

const toDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, day] = val.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  const dt = new Date(val);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatDateOnly = (d) => {
  if (!d) return '';
  const dt = toDate(d) || new Date(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const safeFormatDate = (d) => {
  try {
    const out = formatDateOnly(d);
    return out || '-';
  } catch (e) {
    return '-';
  }
};

const toNumber = (v) => {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[\s,]+/g, '').replace(/[^0-9.-]/g, '');
    return Number(cleaned);
  }
  return NaN;
};

const findStepsInObj = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const direct = ['steps', 'total_steps', 'step_count', 'daily_steps', 'totalSteps', 'stepCount', 'steps_total', 'stepsCount'];
  for (const k of direct) {
    if (k in obj) {
      const n = toNumber(obj[k]);
      if (!Number.isNaN(n)) return n;
    }
  }

  const seen = new Set();
  const stack = [{ val: obj, depth: 0 }];
  while (stack.length) {
    const { val, depth } = stack.pop();
    if (!val || typeof val !== 'object' || seen.has(val)) continue;
    seen.add(val);
    if (Array.isArray(val)) {
      for (const it of val) stack.push({ val: it, depth: depth + 1 });
      continue;
    }
    if (depth > 3) continue;
    for (const [k, v] of Object.entries(val)) {
      if (/step/i.test(k)) {
        const n = toNumber(v);
        if (!Number.isNaN(n)) return n;
      }
      if (v && typeof v === 'object') stack.push({ val: v, depth: depth + 1 });
    }
  }
  return null;
};

const Top5ByMetric = ({ activities = [], dashboardRows = [], sportLabel = 'Sport', disableDashboardSupplement = false, debugLogSteps = false }) => {
  const { dashboardData } = useHealthData() || {};

  const dayBuckets = useMemo(() => {
    const map = new Map();

    const normalizeText = (str) => {
      if (!str) return '';
      let s = String(str).toLowerCase().trim();
      // normalize common Polish diacritics to basic Latin for matching
      s = s.replace(/[ąćęłńóśżź]/g, c => ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ż':'z','ź':'z'}[c] || c));
      return s;
    };

    const mapSport = (raw) => {
      if (!raw) return null;
      const s = normalizeText(raw);
      // flexible substring-based mapping to catch variants like 'Run (Outdoor)', 'Morning Run', 'road bike', etc.
      if (s.includes('fitness_equipment') || s.includes('fitness-equipment') || s.includes('fitness equipment') || s.includes('gym')) return 'gym';
      if (s.includes('run') || s.includes('jog') || s.includes('tempo') || s.includes('fartlek')) return 'running';
      if (s.includes('walk') || s.includes('stroll') || s.includes('spacer') || s.includes('spacer')) return 'walking';
      if (s.includes('hike') || s.includes('trek') || s.includes('trail') || s.includes('trekking') || s.includes('ramble') || s.includes('szlak') || s.includes('wedr') || s.includes('gora') || s.includes('gor')) return 'hiking';
      if (s.includes('cycle') || s.includes('bike') || s.includes('ride') || s.includes('biking') || s.includes('road') || s.includes('gravel') || s.includes('trainer')) return 'cycling';
      if (s.includes('swim') || s.includes('pool') || s.includes('openwater') || s.includes('open water')) return 'swimming';
      return null;
    };

    const allowed = new Set(['running', 'walking', 'hiking', 'swimming', 'cycling', 'gym']);

    for (const a of activities || []) {
      if (!a || !a.start_time) continue;
      // include sub_sport (e.g., 'trail') when present so trail runs are classified as running
      const sportKey = mapSport(a.sport || a.sub_sport || a.type || a.activity_type || a.name || '');
      if (!sportKey || !allowed.has(sportKey)) continue;
      const d = new Date(a.start_time);
      if (isNaN(d.getTime())) continue;
      const iso = d.toISOString().slice(0, 10);
      const entry = map.get(iso) || { distance: 0, count: 0, paceSum: 0, paceCount: 0, minPace: null, minPaceDistance: null, steps: 0, durationMin: 0 };

      let dist = 0;
      if (a.distance_km != null) dist = Number(a.distance_km);
      else if (a.distance != null) {
        const raw = Number(a.distance);
        dist = Number.isFinite(raw) ? raw / 1000 : 0; // convert meters -> km when distance_km not present
      }
      const dur = (a.duration_min != null && Number.isFinite(Number(a.duration_min))) ? Number(a.duration_min) : (durationToMinutes(a) || 0);

      let activityPace = null;
      const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      if (rawPace != null) {
        const p = parsePaceToMinutes(rawPace);
        if (p != null && Number.isFinite(p) && p > 0) activityPace = p;
      }
      if (activityPace == null && dist > 0 && dur > 0) {
        const p2 = paceMinPerKm(dist, dur);
        if (p2 != null && Number.isFinite(p2) && p2 > 0) activityPace = p2;
      }

  entry.distance += dist && Number.isFinite(dist) ? dist : 0;
      entry.count += 1;
      entry.durationMin += dur;
      if (activityPace != null) {
        entry.paceSum += activityPace;
        entry.paceCount += 1;
        if (entry.minPace == null || activityPace < entry.minPace) {
          entry.minPace = activityPace;
          entry.minPaceDistance = dist != null && Number.isFinite(Number(dist)) ? Number(dist) : null;
        }
      }

      const sVal = findStepsInObj(a);
      if (sVal != null && Number.isFinite(Number(sVal))) entry.steps += Number(sVal);
      map.set(iso, entry);
    }

    const rowsSource = disableDashboardSupplement ? [] : ((Array.isArray(dashboardRows) && dashboardRows.length > 0) ? dashboardRows : ((dashboardData?.healthData?.all) || (dashboardData?.windowData) || []));

    if (Array.isArray(rowsSource) && rowsSource.length > 0) {
      const rowsByDate = new Map();
      for (const r of rowsSource) {
        const rawDate = r.day || r.date || r.timestamp || r.day_date;
        if (!rawDate) continue;
        const d = r._dayObj ? r._dayObj : (rawDate ? new Date(rawDate) : null);
        if (!d || isNaN(d.getTime())) continue;
        const key = d.toISOString().slice(0, 10);
        const val = Number(r.steps ?? r.total_steps ?? r.step_count ?? r.daily_steps ?? r.totalSteps ?? r.stepCount ?? 0) || 0;
        const sports = new Set();
        const sportCandidates = [r.sport, r.activity, r.activity_type, r.type, r.source, r.origin, r.category, r.activityKind, r.activity_type_name];
        for (const s of sportCandidates) {
          if (!s) continue;
          const ss = normalizeText(s);
          if (ss.includes('walk')) sports.add('walking');
          if (ss.includes('hike') || ss.includes('trek') || ss.includes('trail') || ss.includes('trekking') || ss.includes('szlak') || ss.includes('wedr') || ss.includes('gora') || ss.includes('gor')) sports.add('hiking');
          if (ss.includes('run') || ss.includes('jog')) sports.add('running');
          if (ss.includes('bike') || ss.includes('cycle') || ss.includes('road')) sports.add('cycling');
          if (ss.includes('swim') || ss.includes('pool') || ss.includes('openwater')) sports.add('swimming');
        }
        const existing = rowsByDate.get(key);
        if (!existing || val > existing.steps) rowsByDate.set(key, { steps: val, sports });
      }

      const sportKey = String(sportLabel || '').toLowerCase();
      const allowSupplement = ['running', 'walking', 'hiking'].includes(sportKey);
      if (allowSupplement) {
        for (const [iso, entry] of map.entries()) {
          if ((!entry.steps || entry.steps === 0) && rowsByDate.has(iso)) {
            const meta = rowsByDate.get(iso);
            const v = meta?.steps || 0;
            const rowIndicatesSport = meta?.sports && meta.sports.has(sportKey);
            if (v > 0 && (rowIndicatesSport || (entry.count && entry.count > 0))) {
              entry.steps = v;
            }
          }
        }
      }
    }

    const arr = Array.from(map.entries()).map(([date, v]) => ({ date, distance: Number(Number(v.distance).toFixed(3)), count: v.count, avgPace: v.minPace != null ? v.minPace : (v.paceCount ? (v.paceSum / v.paceCount) : null), steps: v.steps, durationMin: v.durationMin, minPaceDistance: v.minPaceDistance }));

    if (debugLogSteps) {
      try {
        const sampleActs = (activities || []).slice(0, 5).map(a => ({ id: a?.id ?? a?.activity_id ?? null, start_time: a?.start_time, sport: a?.sport, rawSteps: (() => { try { return findStepsInObj(a); } catch (e) { return null; } })(), distance_km: a?.distance_km ?? a?.distance }));
        const src = disableDashboardSupplement ? [] : ((Array.isArray(dashboardRows) && dashboardRows.length > 0) ? dashboardRows : ((dashboardData?.healthData?.all) || (dashboardData?.windowData) || []));
        const sampleRows = (src || []).slice(0, 8).map(r => ({ day: r?.day ?? r?.date ?? r?.timestamp, steps: r?.steps ?? r?.total_steps ?? r?.step_count ?? null, sportHint: r?.sport ?? r?.activity ?? r?.type ?? null }));
        console.group('[Top5ByMetric debug] sport:', sportLabel);
        console.log('sample activities (first 5):', sampleActs);
        console.log('dayBuckets sample (first 8):', arr.slice(0, 8));
        console.log('dashboard rows sample (first 8):', sampleRows);
        console.groupEnd();
      } catch (e) {
        // ignore
      }
    }

    return arr;
  }, [activities, dashboardRows, dashboardData, sportLabel, disableDashboardSupplement, debugLogSteps]);

  const topK = (arr, key, asc = false, n = 5) => {
    const filtered = arr.filter(x => x[key] != null && (typeof x[key] === 'number' ? Number.isFinite(x[key]) : true));
    filtered.sort((a, b) => (asc ? a[key] - b[key] : b[key] - a[key]));
    return filtered.slice(0, n);
  };

  const metrics = [
    { id: 'distance', title: 'Total distance (km)', fmt: v => v.toFixed(2) },
    { id: 'count', title: 'Activity count', fmt: v => String(v) },
    { id: 'avgPace', title: 'Avg pace (min/km) — fastest', fmt: v => formatPaceMinPerKm(v), asc: true },
    { id: 'steps', title: 'Steps', fmt: v => (v == null ? '-' : String(Math.round(v))) },
    { id: 'durationMin', title: 'Active minutes', fmt: v => (v == null ? '-' : String(Math.round(v))) }
  ];

  return (
    <div className="card mt-6">
      <div className="card-header flex items-center justify-between">
        <h3 className="card-title">Top 5 days by metric — {sportLabel}</h3>
        <div className="text-[11px] text-gray-500">Per-day aggregates within selected period</div>
      </div>
      <div className="card-content">
        {dayBuckets.length === 0 ? (
          <div className="text-sm text-gray-500">No activities for {sportLabel} in the selected period.</div>
        ) : (
          <div className="space-y-4">
            {metrics.map(metric => {
              const arr = dayBuckets;
              const tArr = topK(arr, metric.id === 'avgPace' ? 'avgPace' : metric.id, !!metric.asc);
              const cellText = (obj) => {
                if (!obj) return '—';
                const key = metric.id === 'avgPace' ? 'avgPace' : metric.id;
                const v = obj[key];
                if (v == null) return '—';
                if (typeof v === 'number' && v === 0) return '—';
                if (metric.id === 'avgPace') {
                  const paceStr = formatPaceMinPerKm(v);
                  const dist = obj.minPaceDistance != null ? ` (${obj.minPaceDistance.toFixed(2)} km)` : '';
                  return `${paceStr}${dist}`;
                }
                return metric.fmt(v);
              };

              return (
                <div key={metric.id} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{metric.title}</div>
                    {metric.id === 'avgPace' ? <div className="text-xs text-gray-500">lower is better</div> : null}
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm table-fixed">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="w-12 pr-4">#</th>
                          <th className="pr-4">{sportLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2, 3, 4].map(i => {
                          const item = tArr[i];
                          const cellFor = (obj) => {
                            if (!obj) return '—';
                            const txt = cellText(obj);
                            if (txt === '—') return '—';
                            if (metric.id === 'steps') {
                              const dist = obj.distance != null && Number.isFinite(Number(obj.distance)) ? ` (${Number(obj.distance).toFixed(2)} km)` : '';
                              return `${safeFormatDate(obj.date)}: ${txt}${dist}`;
                            }
                            return `${safeFormatDate(obj.date)}: ${txt}`;
                          };
                          return (
                            <tr key={i} className="border-t">
                              <td className="py-2 pr-4 font-medium">{i + 1}</td>
                              <td className="py-2 pr-4">{cellFor(item)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Top5ByMetric;
