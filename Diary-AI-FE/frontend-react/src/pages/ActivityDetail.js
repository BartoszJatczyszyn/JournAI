import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ChartTooltip from '../components/ui/ChartTooltip';
import { Button } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import MetricCard from '../components/MetricCard';
import { activitiesAPI } from '../services';
import { formatPaceMinPerKm } from '../utils/timeUtils';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Cell
} from 'recharts';

const ActivityDetail = () => {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Single-activity view only – no multi-activity trends/history

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await activitiesAPI.getActivityById(id);
        setActivity(res.activity);
      } catch (e) {
        setError('Failed to load activity');
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Derived metrics rely solely on this single activity
  const derived = useMemo(() => {
    if (!activity) return {};
    const out = {};
    const distanceKm = typeof activity.distance_km === 'number' ? activity.distance_km : (activity.distance ? activity.distance / 1000 : null);
    const durationMin = typeof activity.duration_min === 'number' ? activity.duration_min : (activity.elapsed_time ? activity.elapsed_time / 60 : null);
    if (distanceKm != null && durationMin != null && distanceKm > 0) {
      const v = durationMin / distanceKm; // min per km
      out.pace_computed = v;
      out.speed_computed = 60 / v; // km/h
    } else if (activity.avg_speed != null) {
      out.pace_computed = 60 / activity.avg_speed;
    } else if (activity.avg_pace != null) {
      out.speed_computed = 60 / activity.avg_pace;
    }
    if (distanceKm != null) out.distance_miles = +(distanceKm * 0.621371).toFixed(2);
    if (durationMin != null) out.duration_hms = (() => {
      const totalSec = Math.round(durationMin * 60);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return [h,m,s].map(x => String(x).padStart(2,'0')).join(':');
    })();
    if (activity.calories != null && durationMin != null && durationMin > 0) {
      out.cal_per_min = +(activity.calories / durationMin).toFixed(2);
      if (distanceKm) out.cal_per_km = +(activity.calories / distanceKm).toFixed(1);
    }
    if (activity.avg_hr != null && durationMin != null) {
      out.hr_load_index = +(activity.avg_hr * durationMin).toFixed(0); // simple proxy
    }
    return out;
  }, [activity]);

  // Normalization heuristics for radar & bar charts (sport-adaptive)
  const chartData = useMemo(() => {
    if (!activity) return { radar: [], bars: [] };
    const sport = (activity.sport || '').toLowerCase();
    const isRun = /run/.test(sport);
    const isRide = /(ride|cycl|bike)/.test(sport);
    const distanceRef = isRun ? 42.2 : isRide ? 200 : 100;
    const durationRef = isRun ? 180 : isRide ? 360 : 300; // minutes
    const speedRef = isRun ? 22 : isRide ? 55 : 35; // km/h
    const caloriesRef = isRun ? 2200 : isRide ? 4500 : 3000;
    const distance = activity.distance_km ?? (activity.distance ? activity.distance / 1000 : null);
    const duration = activity.duration_min ?? (activity.elapsed_time ? activity.elapsed_time / 60 : null);
    const speed = activity.avg_speed ?? (derived.speed_computed || null);
    const calories = activity.calories ?? null;
    const aer = activity.training_effect ?? null; // 0-5
    const ana = activity.anaerobic_training_effect ?? null; // 0-5

    const pct = (val, ref) => (val == null || ref == null || ref === 0) ? null : Math.min(100, +(val / ref * 100).toFixed(1));
    const pctEff = v => v == null ? null : +(Math.min(5, Math.max(0, v)) / 5 * 100).toFixed(1);

    const radar = [
      { metric: 'Distance', value: pct(distance, distanceRef) },
      { metric: 'Duration', value: pct(duration, durationRef) },
      { metric: 'Speed', value: pct(speed, speedRef) },
      { metric: 'Calories', value: pct(calories, caloriesRef) },
      { metric: 'Aerobic Eff', value: pctEff(aer) },
      { metric: 'Anaerobic Eff', value: pctEff(ana) },
    ].filter(d => d.value != null);

    const bars = [
      { label: 'Distance (km)', raw: distance, ref: distanceRef },
      { label: 'Duration (min)', raw: duration, ref: durationRef },
      { label: 'Avg Speed (km/h)', raw: speed, ref: speedRef },
      { label: 'Calories', raw: calories, ref: caloriesRef },
      { label: 'Aerobic Eff', raw: aer, ref: 5 },
      { label: 'Anaerobic Eff', raw: ana, ref: 5 },
      { label: 'Cal / km', raw: derived.cal_per_km, ref: (caloriesRef / distanceRef) || 100 },
      { label: 'Cal / min', raw: derived.cal_per_min, ref: (caloriesRef / durationRef) || 10 },
      { label: 'HR Load Idx', raw: derived.hr_load_index, ref: (180 * durationRef) || 40000 }
    ].filter(r => r.raw != null && Number.isFinite(r.raw)).map(r => ({ ...r, pct: pct(r.raw, r.ref) }));

    return { radar, bars };
  }, [activity, derived]);

  // Additional numeric metrics not shown in summary cards (auto-discovery)
  const additionalMetrics = useMemo(() => {
    if (!activity) return [];
    const exclude = new Set([
      'activity_id','name','sport','sub_sport','start_time','stop_time','elapsed_time','distance','distance_km','duration_min','avg_pace','avg_speed','avg_hr','max_hr','calories','training_load','training_effect','anaerobic_training_effect'
    ]);
    return Object.entries(activity)
      .filter(([k,v]) => !exclude.has(k) && v != null && (typeof v === 'number' || (typeof v === 'string' && v.length < 60)))
      .slice(0, 40);
  }, [activity]);

  if (loading && !activity) return <LoadingSpinner message="Loading activity..." />;
  if (error && !activity) return <ErrorMessage message={error} />;
  if (!activity) return null;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">{activity.name || 'Activity'} <span className="text-gray-500 text-base font-normal">({activity.sport || '-'})</span></h1>
          <p className="page-subtitle">{activity.start_time ? new Date(activity.start_time).toLocaleString() : ''}</p>
        </div>
        <div className="header-controls flex gap-3 items-center flex-wrap">
          <Button as={Link} to="/activity" variant="secondary">← Back</Button>
        </div>
      </div>

      {/* Overview Metrics styled like Sleep page */}
      <div className="overview-metrics mb-8">
        <MetricCard
          title="Distance"
          value={activity.distance_km != null ? activity.distance_km.toFixed(2) : '—'}
          unit={activity.distance_km != null ? 'km' : ''}
          icon="📏"
          color="indigo"
          subtitle={activity.duration_min != null ? `${(activity.duration_min).toFixed(0)} min total` : ''}
        />
        <MetricCard
          title="Duration"
          value={activity.duration_min != null ? activity.duration_min.toFixed(1) : '—'}
          unit={activity.duration_min != null ? 'min' : ''}
          icon="⏱️"
          color="green"
          subtitle={activity.avg_speed != null ? `${activity.avg_speed.toFixed(2)} km/h avg speed` : ''}
        />
        <MetricCard
          title="Avg Pace"
          value={activity.avg_pace != null ? formatPaceMinPerKm(activity.avg_pace) : '—'}
          unit={activity.avg_pace != null ? 'min/km' : ''}
          icon="🏃"
          color="blue"
          subtitle={activity.max_speed != null ? `Max speed ${(activity.max_speed).toFixed(2)} km/h` : ''}
        />
        <MetricCard
          title="Avg HR"
            value={activity.avg_hr != null ? activity.avg_hr.toFixed(0) : '—'}
          unit={activity.avg_hr != null ? 'bpm' : ''}
          icon="❤️"
          color="rose"
          subtitle={activity.max_hr != null ? `Max ${activity.max_hr}` : ''}
        />
        <MetricCard
          title="Calories"
          value={activity.calories != null ? activity.calories.toFixed(0) : '—'}
          unit={activity.calories != null ? 'kcal' : ''}
          icon="🔥"
          color="amber"
          subtitle={activity.training_load ? `Load ${activity.training_load}` : ''}
        />
        <MetricCard
          title="Effects"
          value={(() => {
            const a = activity.training_effect != null ? activity.training_effect : null;
            const b = activity.anaerobic_training_effect != null ? activity.anaerobic_training_effect : null;
            if (a == null && b == null) return '—';
            return `${a != null ? a.toFixed?.(1) : '-'} / ${b != null ? b.toFixed?.(1) : '-'}`;
          })()}
          unit=""
          icon="⚡"
          color="purple"
          subtitle="Aer / Ana"
        />
      </div>

      <div className="page-content space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card md:col-span-1">
            <div className="card-header"><h3 className="card-title">Core Metrics</h3></div>
            <div className="card-content">
              <ul className="space-y-2 text-sm">
                <li><strong>Sport:</strong> {activity.sport || '-'}</li>
                <li><strong>Distance:</strong> {activity.distance_km != null ? `${activity.distance_km} km` : '-'}</li>
                <li><strong>Duration:</strong> {activity.duration_min != null ? `${activity.duration_min} min` : '-'}</li>
                <li><strong>Avg Pace:</strong> {activity.avg_pace != null ? `${formatPaceMinPerKm(activity.avg_pace)} min/km` : (derived.pace_computed ? `${formatPaceMinPerKm(derived.pace_computed)}*` : '-')}</li>
                <li><strong>Avg Speed:</strong> {activity.avg_speed != null ? `${activity.avg_speed.toFixed(2)} km/h` : (derived.speed_computed ? `${derived.speed_computed.toFixed(2)}* km/h` : '-')}</li>
                <li><strong>Calories:</strong> {activity.calories != null ? activity.calories : '-'}</li>
                <li><strong>Avg HR:</strong> {activity.avg_hr != null ? `${activity.avg_hr} bpm` : '-'}</li>
                <li><strong>Max HR:</strong> {activity.max_hr != null ? `${activity.max_hr} bpm` : '-'}</li>
                <li><strong>Training Load:</strong> {activity.training_load || '-'}</li>
                <li><strong>Training Effect:</strong> {activity.training_effect || '-'}</li>
                <li><strong>Anaerobic Effect:</strong> {activity.anaerobic_training_effect || '-'}</li>
              </ul>
              <p className="mt-3 text-[10px] text-gray-500">* computed locally</p>
            </div>
          </div>
          <div className="card md:col-span-1">
            <div className="card-header"><h3 className="card-title">Derived Metrics</h3></div>
            <div className="card-content text-sm">
              <ul className="space-y-2">
                {derived.distance_miles != null && <li><strong>Distance (mi):</strong> {derived.distance_miles}</li>}
                {derived.duration_hms && <li><strong>Duration (h:m:s):</strong> {derived.duration_hms}</li>}
                {derived.pace_computed && <li><strong>Computed Pace:</strong> {formatPaceMinPerKm(derived.pace_computed)} min/km</li>}
                {derived.speed_computed && <li><strong>Computed Speed:</strong> {derived.speed_computed.toFixed(2)} km/h</li>}
                {derived.cal_per_min != null && <li><strong>Calories / min:</strong> {derived.cal_per_min}</li>}
                {derived.cal_per_km != null && <li><strong>Calories / km:</strong> {derived.cal_per_km}</li>}
                {derived.hr_load_index != null && <li><strong>HR Load Index:</strong> {derived.hr_load_index}</li>}
              </ul>
              {Object.keys(derived).length === 0 && <div className="text-xs text-gray-500">No derived metrics available.</div>}
            </div>
          </div>
          <div className="card md:col-span-1">
            <div className="card-header"><h3 className="card-title">Additional Metrics</h3></div>
            <div className="card-content text-sm">
              {additionalMetrics.length ? (
                <ul className="space-y-1 max-h-64 overflow-auto pr-2 text-xs">
                  {additionalMetrics.map(([k,v]) => (
                    <li key={k}><strong>{k}:</strong> {String(v)}</li>
                  ))}
                </ul>
              ) : <div className="text-xs text-gray-500">No extra numeric fields.</div>}
            </div>
          </div>
        </div>

        {/* Radar Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card md:col-span-1">
            <div className="card-header"><h3 className="card-title">Effort Radar</h3><span className="text-[10px] text-gray-500 ml-auto">% of reference</span></div>
            <div className="card-content" style={{ height: 330 }}>
              {chartData.radar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData.radar} outerRadius="75%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <div className="text-xs text-gray-500">Insufficient metrics for radar.</div>}
            </div>
            <div className="px-4 pb-4 text-[10px] text-gray-500 space-y-1">
              <div>Heurystyczne skalowanie wg typu sportu.</div>
              <div>Eff = TE (0–5) → %.</div>
            </div>
          </div>
          <div className="card md:col-span-2">
            <div className="card-header"><h3 className="card-title">Metric Intensity</h3><span className="text-[10px] text-gray-500 ml-auto">Bar = wartość · % ref</span></div>
            <div className="card-content" style={{ height: 330 }}>
              {chartData.bars.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.bars} layout="vertical" margin={{ left: 80, top: 10, right: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" hide domain={[0, (dataMax) => Math.max(dataMax * 1.05, 1)]} />
                    <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip mapPayload={({ payload, label }) => ({ title: label, items: (payload || []).map(p => ({ label: p.name, value: p.value ?? '—', color: p.color })) })} />} />
                    <Bar dataKey="raw" name="Value" radius={[4,4,4,4]}>
                      {chartData.bars.map((b,i) => {
                        const hue = 210 - (b.pct != null ? Math.min(100, b.pct) : 0) * 1.4; // dynamic color
                        return <Cell key={i} fill={`hsl(${hue} 70% 55%)`} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-xs text-gray-500">Brak danych do wizualizacji.</div>}
            </div>
            <div className="px-4 pb-4 text-[10px] text-gray-500 space-y-1">
              <div>% Ref wyliczone dynamicznie (distance/duration/speed/calories dostosowane do sportu).</div>
              <div>Kolor przechodzi z niebieskiego (niski %) do zielonkawego (wyższy %).</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Raw Activity Payload</h3></div>
          <div className="card-content">
            <pre className="text-xs whitespace-pre-wrap max-h-[420px] overflow-auto">{JSON.stringify(activity, null, 2)}</pre>
          </div>
        </div>
      </div>

      <style jsx>{`
        .overview-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .header-content { flex: 1; }
        .page-title { margin: 0 0 6px 0; font-size: 1.7rem; font-weight: 700; }
        .page-subtitle { margin: 0; color: #64748b; font-size: 0.9rem; }
        .header-controls { }
        @media (max-width: 768px) { .overview-metrics { grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); } .page-title { font-size: 1.35rem; } }
    /* tooltip styling unified in src/index.css */
      `}</style>
    </div>
  );
};

export default ActivityDetail;
