import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Line } from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { parsePaceToMinutes, paceMinPerKm, durationToMinutes, formatPaceMinPerKm } from '../utils/timeUtils';

export default function DistanceHistogram({ activities = [], sport = 'walking', binWidth = 5, maxBins = 10, height = 220 }) {
  const data = useMemo(() => {
    const allRuns = activities || [];
    const wanted = (sport == null || String(sport).toLowerCase() === 'all') ? null : String(sport || 'walking').toLowerCase();
    // filter out activities without positive distance and exclude gym/strength sessions
    const runs = (wanted ? allRuns.filter(a => (a.sport || '').toLowerCase() === wanted) : allRuns)
      .filter(a => {
        // require explicit distance_km field (user requested) and positive
        if (a.distance_km == null) return false;
        const dist = Number(a.distance_km);
        if (!Number.isFinite(dist) || !(dist > 0)) return false;
        const sp = (a.sport || '').toLowerCase();
        if (!sp) return true;
        // exclude gym/strength/weight sessions
        if (sp.includes('gym') || sp.includes('strength') || sp.includes('weight')) return false;
        return true;
      });
    const dists = runs.map(a => {
      const d = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : null);
      return (d != null && Number.isFinite(d) && d > 0) ? d : null;
    }).filter(d => d != null);

    const maxDist = dists.length ? Math.max(...dists) : (binWidth * Math.min(maxBins, 4));

    // If maxDist fits within the simple binWidth * maxBins window, keep the simple uniform binning.
    // Otherwise, create a hybrid set of edges: regular small buckets up to 100 km, then larger buckets
    // 100-150, 150-200 and a final 200+ open bucket so extreme rides are separated.
    let edges = [];
    if (maxDist <= binWidth * maxBins) {
      const binsCount = Math.min(maxBins, Math.max(1, Math.ceil(maxDist / binWidth)));
      for (let i = 0; i <= binsCount; i++) edges.push(i * binWidth);
      // proceed with uniform bins
    } else {
      const cutoff = 100;
      // small regular buckets up to cutoff
      let v = 0;
      while (v <= cutoff) {
        edges.push(v);
        v += binWidth;
      }
      if (edges[edges.length - 1] < cutoff) edges.push(cutoff);
      // add larger buckets
      edges.push(150);
      edges.push(200);
      // ensure sorted unique edges
      edges = Array.from(new Set(edges)).sort((a, b) => a - b);
    }

    const binsCount = Math.max(1, edges.length - 1);
    const buckets = new Array(binsCount).fill(0).map(() => ({ count: 0, speedSum: 0, speedCount: 0, distanceSum: 0 }));

    runs.forEach(a => {
      const dist = a.distance_km != null ? Number(a.distance_km) : (a.distance != null ? Number(a.distance) : null);
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
        // falls into the last (open-ended) bucket
        idx = edges.length - 2;
      }

      // compute speed (km/h) from pace or duration+distance
      let speed = null;
      const rawPace = a.avg_pace ?? a.avgPace ?? a.avg_pace_min ?? null;
      if (rawPace != null) {
        const paceMin = parsePaceToMinutes(rawPace);
        if (paceMin != null && paceMin > 0) speed = 60 / paceMin;
      }
      if (speed == null) {
        // pass full activity so durationToMinutes can detect the correct field/unit
        const dur = durationToMinutes(a);
        const pace = paceMinPerKm(dist, dur);
        if (pace != null && pace > 0) speed = 60 / pace;
      }

      buckets[idx].count += 1;
      if (speed != null && Number.isFinite(speed)) {
        buckets[idx].speedSum += speed;
        buckets[idx].speedCount += 1;
      }
      // accumulate total distance in this bucket
      buckets[idx].distanceSum += dist;
    });

    const lastEdge = edges[edges.length - 1];
    const out = buckets.map((b, i) => {
      const lower = edges[i];
      const upper = edges[i + 1];
      // if maxDist exceeds the last edge, show open-ended label for the last bucket
      const isLast = i === buckets.length - 1;
      const label = (isLast && maxDist > lastEdge) ? `${lower}+ km` : `${lower}-${upper} km`;
      const avgSpeed = b.speedCount ? (b.speedSum / b.speedCount) : null;
      const avgPace = (avgSpeed != null && avgSpeed > 0) ? (60 / avgSpeed) : null; // min/km
      const totalDist = b.distanceSum ? Number(b.distanceSum.toFixed(2)) : 0;
      return { bucket: label, count: b.count, avgSpeed: avgSpeed != null ? Number(avgSpeed.toFixed(2)) : null, avgPace: avgPace != null ? Number(avgPace) : null, totalDist };
    });

    return out;
  }, [activities, sport, binWidth, maxBins]);

  const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    const row = payload[0].payload || {};
  const items = [{ label: 'Count', value: row.count ?? 0, color: '#0ea5e9' }];
  if (row.totalDist != null) items.push({ label: 'Distance (km)', value: row.totalDist, color: '#0ea5e9' });
  if (row.avgSpeed != null) items.push({ label: 'Avg speed', value: `${row.avgSpeed} km/h`, color: '#f59e0b' });
  if (row.avgPace != null) items.push({ label: 'Avg pace', value: `${formatPaceMinPerKm(row.avgPace)} min/km`, color: '#10b981' });
    return { title: label, items };
  };

  const anyData = data.some(d => d.count > 0);
  if (!anyData) return <div className="text-xs text-gray-500">No walking distances available for histogram.</div>;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Avg speed (km/h)', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: 11 } }} />
          <ReTooltip content={<ChartTooltip mapPayload={mapTooltip} />} />
          <Bar yAxisId="left" dataKey="count" name="Walk count" fill="#0ea5e9" radius={[4,4,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="avgSpeed" name="Avg speed (km/h)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
