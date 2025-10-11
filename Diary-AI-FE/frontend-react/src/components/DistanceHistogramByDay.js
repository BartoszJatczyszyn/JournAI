import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Line } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { parsePaceToMinutes, paceMinPerKm, durationToMinutes, formatPaceMinPerKm } from '../utils/timeUtils';

// Aggregates activities by calendar day (ISO date) and then constructs the same bin histogram
export default function DistanceHistogramByDay({ activities = [], sport = 'walking', binWidth = 5, maxBins = 10, height = 220 }) {
  const data = useMemo(() => {
    const allRuns = activities || [];
    const wanted = (sport == null || String(sport).toLowerCase() === 'all') ? null : String(sport || 'walking').toLowerCase();
    const runsPre = wanted ? allRuns.filter(a => (a.sport || '').toLowerCase() === wanted) : allRuns;
    // filter out activities without positive distance and exclude gym/strength sessions
    const runs = runsPre.filter(a => {
      // require explicit distance_km field
      if (a.distance_km == null) return false;
      const dist = Number(a.distance_km);
      if (!Number.isFinite(dist) || !(dist > 0)) return false;
      const sp = (a.sport || '').toLowerCase();
      if (!sp) return true;
      if (sp.includes('gym') || sp.includes('strength') || sp.includes('weight')) return false;
      return true;
    });

    // Group by ISO date (YYYY-MM-DD)
    const byDate = new Map();
    runs.forEach(a => {
      const ts = a.start_time ? new Date(a.start_time) : null;
      if (!ts || isNaN(ts.getTime())) return;
      const iso = ts.toISOString().slice(0, 10);
      const entry = byDate.get(iso) || { distanceSum: 0, paceSum: 0, speedSum: 0, rawCount: 0 };
      const dist = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : null);

      // compute activity-level pace (min/km) and speed (km/h)
      let activityPace = null;
      const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      if (rawPace != null) {
        const p = parsePaceToMinutes(rawPace);
        if (p != null && Number.isFinite(p) && p > 0) activityPace = p;
      }
      if (activityPace == null) {
        const dur = durationToMinutes(a);
        const p2 = paceMinPerKm(dist, dur);
        if (p2 != null && Number.isFinite(p2) && p2 > 0) activityPace = p2;
      }
      const activitySpeed = (activityPace != null && activityPace > 0) ? (60 / activityPace) : null;

      entry.distanceSum += dist && Number.isFinite(dist) ? dist : 0;
      // Per your request: sum activity-level avg_pace and avg_speed and divide by number of walks later
      entry.paceSum += activityPace != null && Number.isFinite(activityPace) ? activityPace : 0;
      entry.speedSum += activitySpeed != null && Number.isFinite(activitySpeed) ? activitySpeed : 0;
      entry.rawCount += 1;
      byDate.set(iso, entry);
    });

    const days = Array.from(byDate.entries()).map(([date, v]) => {
      const avgPace = v.rawCount > 0 ? (v.paceSum / v.rawCount) : null;
      const avgSpeed = v.rawCount > 0 ? (v.speedSum / v.rawCount) : null;
      return { date: date, distance: Number(Number(v.distanceSum).toFixed(3)), pace: avgPace != null ? Number(avgPace) : null, speed: avgSpeed != null ? Number(avgSpeed) : null };
    }).sort((a,b)=> new Date(a.date) - new Date(b.date));

    const dists = days.map(d => d.distance).filter(d => d != null);
    const maxDist = dists.length ? Math.max(...dists) : (binWidth * Math.min(maxBins, 4));

    // Hybrid bin edges: if maxDist is small, use uniform bins; otherwise, add larger buckets to split extremes
    let edges = [];
    if (maxDist <= binWidth * maxBins) {
      const binsCount = Math.min(maxBins, Math.max(1, Math.ceil(maxDist / binWidth)));
      for (let i = 0; i <= binsCount; i++) edges.push(i * binWidth);
    } else {
      const cutoff = 100;
      let v = 0;
      while (v <= cutoff) {
        edges.push(v);
        v += binWidth;
      }
      if (edges[edges.length - 1] < cutoff) edges.push(cutoff);
      edges.push(150);
      edges.push(200);
      edges = Array.from(new Set(edges)).sort((a, b) => a - b);
    }

    const binsCount = Math.max(1, edges.length - 1);
    const buckets = new Array(binsCount).fill(0).map(() => ({ count: 0, speedSum: 0, speedCount: 0, paceSum: 0, paceCount: 0, distanceSum: 0 }));

    days.forEach(d => {
      const dist = d.distance;
      if (!(dist > 0)) return;
      // find bucket index based on edges (supports irregular edges when handling large distances)
      let idx = -1;
      for (let i = 0; i < edges.length - 1; i++) {
        if (dist >= edges[i] && dist < edges[i + 1]) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        idx = edges.length - 2;
      }
      buckets[idx].count += 1;
      if (d.speed != null && Number.isFinite(d.speed)) {
        buckets[idx].speedSum += d.speed;
        buckets[idx].speedCount += 1;
      }
      if (d.pace != null && Number.isFinite(d.pace)) {
        buckets[idx].paceSum += d.pace;
        buckets[idx].paceCount += 1;
      }
      buckets[idx].distanceSum += d.distance;
    });

    const lastEdge = edges[edges.length - 1];
    const out = buckets.map((b, i) => {
      const lower = edges[i];
      const upper = edges[i+1];
      const isLast = i === buckets.length - 1;
      const label = (isLast && maxDist > lastEdge) ? `${lower}+ km` : `${lower}-${upper} km`;
      const avgSpeed = b.speedCount ? (b.speedSum / b.speedCount) : null;
      const avgPace = b.paceCount ? (b.paceSum / b.paceCount) : null;
      const totalDist = b.distanceSum ? Number(b.distanceSum.toFixed(2)) : 0;
      return { bucket: label, count: b.count, avgSpeed: avgSpeed != null ? Number(avgSpeed.toFixed(2)) : null, avgPace: avgPace != null ? Number(avgPace) : null, totalDist };
    });

    return out;
  }, [activities, sport, binWidth, maxBins]);

  const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    const row = payload[0].payload || {};
    const items = [{ label: 'Days', value: row.count ?? 0, color: '#0ea5e9' }];
    if (row.totalDist != null) items.push({ label: 'Distance (km)', value: row.totalDist, color: '#0ea5e9' });
    if (row.avgSpeed != null) items.push({ label: 'Avg speed', value: `${row.avgSpeed} km/h`, color: '#f59e0b' });
    if (row.avgPace != null) items.push({ label: 'Avg pace', value: `${formatPaceMinPerKm(row.avgPace)} min/km`, color: '#10b981' });
    return { title: label, items };
  };

  const anyData = data.some(d => d.count > 0);
  if (!anyData) return <div className="text-xs text-gray-500">No walking daily totals available for histogram.</div>;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Avg speed (km/h)', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: 11 } }} />
          <ReTooltip content={<ChartTooltip mapPayload={mapTooltip} />} />
          <Bar yAxisId="left" dataKey="count" name="Days count" fill="#0ea5e9" radius={[4,4,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="avgSpeed" name="Avg speed (km/h)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
