import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sleepsAPI } from '../services';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';

ChartJS.register(ArcElement, Tooltip, Legend);

// Plugin: draw percentage labels inside doughnut slices
const doughnutPercentPlugin = {
  id: 'doughnutPercentPlugin',
  afterDraw: (chart) => {
    try {
      // limit to doughnut/pie charts
      const type = chart.config && chart.config.type;
      if (type !== 'doughnut' && type !== 'pie') return;
      const ctx = chart.ctx;
      const dataset = chart.data && chart.data.datasets && chart.data.datasets[0];
      if (!dataset) return;
      const meta = chart.getDatasetMeta(0);
      const total = dataset.data.reduce((s, v) => s + (Number(v) || 0), 0);
      ctx.save();
      meta.data.forEach((arc, idx) => {
        const value = Number(dataset.data[idx]) || 0;
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        // compute middle point of arc
        const start = arc.startAngle;
        const end = arc.endAngle;
        const angle = (start + end) / 2;
        const r = (arc.outerRadius + arc.innerRadius) / 2;
        const x = arc.x + Math.cos(angle) * r;
        const y = arc.y + Math.sin(angle) * r;
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, x, y);
      });
      ctx.restore();
    } catch (e) {
      // silently fail - don't break chart rendering
    }
  }
};

ChartJS.register(doughnutPercentPlugin);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const time = new Date(data.t).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const items = [
      { name: 'HR', value: data.hr, unit: 'bpm', color: '#ef4444' },
      { name: 'Stress', value: data.stress, unit: '', color: '#0ea5e9' },
      { name: 'RR', value: data.rr, unit: '', color: '#10b981' },
    ];
    
    return (
      <div className="custom-tooltip">
        <p className="label">{`Time: ${time}`}</p>
        {items.map((item, index) => (
          item.value != null && (
            <p key={index} style={{ color: item.color }}>
              {`${item.name}: ${item.value} ${item.unit}`}
            </p>
          )
        ))}
      </div>
    );
  }
  return null;
};

const CustomStageTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.name) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`Stage: ${data.name}`}</p>
        </div>
      );
    }
  }
  return null;
};

const SleepDetail = () => {
  const { id } = useParams();
  const [sleep, setSleep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await sleepsAPI.getSleepById(id);
        setSleep(res.sleep);
      } catch (e) {
        setError('Failed to load sleep');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!sleep) return;
    const toMs = (x) => {
      try {
        return x ? new Date(x).getTime() : null;
      } catch {
        return null;
      }
    };

    const hrMap = new Map(
      (sleep.hr_series || []).map((p) => [toMs(p.ts), p.bpm])
    );
    const stressMap = new Map(
      (sleep.stress_series || []).map((p) => [toMs(p.ts), p.stress])
    );
    const rrMap = new Map(
      (sleep.rr_series || []).map((p) => [toMs(p.ts), p.rr])
    );

    const allTimestamps = [
      ...hrMap.keys(),
      ...stressMap.keys(),
      ...rrMap.keys(),
    ];
    const uniqueTimestamps = [...new Set(allTimestamps)].filter(Boolean);
    uniqueTimestamps.sort((a, b) => a - b);

    setChartData(
      uniqueTimestamps.map((t) => ({
        t,
        hr: hrMap.get(t),
        stress: stressMap.get(t),
        rr: rrMap.get(t),
      }))
    );
  }, [sleep]);

  if (loading && !sleep) return <div>Loading sleep...</div>;
  if (error && !sleep) return <div>{error}</div>;
  if (!sleep) return null;

  const toMs = (x) => (x ? new Date(x).getTime() : null);
  const startMs = toMs(sleep.sleep_start);
  const endMs = toMs(sleep.sleep_end);

  const rawEvents = Array.isArray(sleep.sleep_events)
    ? sleep.sleep_events
        .filter((e) => e.timestamp && e.event)
        .map((e) => ({
          event: String(e.event || '').toLowerCase(),
          t1: toMs(e.timestamp),
          dur: typeof e.duration_sec === 'number' ? e.duration_sec * 1000 : null
        }))
    : [];
  const sortedEvents = rawEvents
    .filter((e) => typeof e.t1 === 'number')
    .sort((a, b) => a.t1 - b.t1);
  const events = sortedEvents.map((e, idx) => {
    const next = sortedEvents[idx + 1];
    let t2 =
      e.dur && e.dur > 0 ? e.t1 + e.dur : next ? next.t1 : endMs;
    if (typeof startMs === 'number') t2 = Math.max(t2, startMs);
    if (typeof endMs === 'number') t2 = Math.min(t2, endMs);
    return { event: e.event, t1: e.t1, t2 };
  });

  const stageFill = (ev) => {
    const name = String(ev || '').toLowerCase();
  // Use the same phase palette as Sleep.js for visual consistency
  // Deep:  #8b5cf6  -> rgb(139,92,246)
  // Light: #22c55e  -> rgb(34,197,94)
  // REM:   #06b6d4  -> rgb(6,182,212)
  // Awake: #ef4444  -> rgb(239,68,68)
  if (name.includes('deep')) return 'rgba(139, 92, 246, 0.60)';
  if (name.includes('light')) return 'rgba(34, 197, 94, 0.60)';
  if (name.includes('rem')) return 'rgba(6, 182, 212, 0.60)';
  if (name.includes('awake') || name.includes('wake')) return 'rgba(239, 68, 68, 0.60)';
  return 'rgba(148, 163, 184, 0.10)';
  };

  const allTs = chartData
    .map((d) => d.t)
    .filter((t) => typeof t === 'number');
  const minTs = allTs.length ? Math.min(...allTs) : startMs;
  const maxTs = allTs.length ? Math.max(...allTs) : endMs;
  const domainStart = Number.isFinite(startMs) ? startMs : minTs;
  const domainEnd = Number.isFinite(endMs) ? endMs : maxTs;

  const hasChartData = chartData && chartData.length > 0;
  const hasEventData = events && events.length > 0;

  const formatTimeLabel = (t) => {
    try {
      const d = typeof t === 'number' ? new Date(t) : new Date(t);
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(t);
    }
  };

  const fmt = (n) => (n != null ? n : '-');

  // Format seconds or minutes into "Xh Ym" or "Ym"
  const formatDuration = (value, unit = 'seconds') => {
    if (value == null) return '-';
    let minutes = 0;
    if (unit === 'seconds') {
      minutes = Math.round(Number(value) / 60);
    } else if (unit === 'minutes') {
      minutes = Math.round(Number(value));
    } else {
      minutes = Math.round(Number(value));
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };
  const fmtDate = (date) =>
    date ? new Date(date).toLocaleString() : '-';
  const fmtEff = (v) => (v == null ? '-' : `${v}%`);

  const scoreClass =
    sleep?.sleep_score >= 80
      ? 'text-green-600'
      : sleep?.sleep_score >= 60
      ? 'text-yellow-600'
      : 'text-red-600';
      
  const stageToValue = (stage) => {
    const s = String(stage || '').toLowerCase().trim();
    if (s.includes('awake') || s.includes('wake')) return 4;
    if (s.includes('rem')) return 3;
    if (s.includes('light')) return 2;
    if (s.includes('deep')) return 1;
    return 0;
  };

  const valueToStage = (value) => {
    if (value === 4) return 'Awake';
    if (value === 3) return 'REM';
    if (value === 2) return 'Light';
    if (value === 1) return 'Deep';
    return '';
  };

  // ZMIANA: Poprawiona logika, aby rozciągnąć wykres na cały okres snu
  const sleepStageData = [];
  if (hasEventData && startMs && endMs) {
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    // 1. Dodaj punkt na samym początku snu (startMs), używając fazy z pierwszego zdarzenia
    sleepStageData.push({
      t: startMs,
      stage: stageToValue(firstEvent.event),
      name: firstEvent.event.charAt(0).toUpperCase() + firstEvent.event.slice(1)
    });

    // 2. Dodaj punkty dla każdego zarejestrowanego zdarzenia (fazy)
    events.forEach(e => {
      sleepStageData.push({
        t: e.t1,
        stage: stageToValue(e.event),
        name: e.event.charAt(0).toUpperCase() + e.event.slice(1)
      });
    });

    // 3. Dodaj punkt na samym końcu snu (endMs), używając fazy z ostatniego zdarzenia
    sleepStageData.push({
      t: endMs,
      stage: stageToValue(lastEvent.event),
      name: lastEvent.event.charAt(0).toUpperCase() + lastEvent.event.slice(1)
    });
  }

  const computeEfficiency = () => {
    if (
      sleep.efficiency_pct !== undefined &&
      sleep.efficiency_pct !== null
    ) {
      const v = Number(sleep.efficiency_pct);
      if (!Number.isNaN(v))
        return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
    }
    const parseDate = (s) => {
      try {
        return s ? new Date(s) : null;
      } catch (e) {
        return null;
      }
    };
    const start = parseDate(sleep.sleep_start);
    const end = parseDate(sleep.sleep_end);
    let tibSec = null;
    if (start && end) {
      tibSec = (end.getTime() - start.getTime()) / 1000;
      if (tibSec <= 0) tibSec += 24 * 60 * 60;
    }
    const sleepDuration =
      sleep.sleep_duration_seconds !== undefined &&
      sleep.sleep_duration_seconds !== null
        ? Number(sleep.sleep_duration_seconds)
        : null;
    const awakeSec =
      sleep.awake_seconds !== undefined && sleep.awake_seconds !== null
        ? Number(sleep.awake_seconds)
        : 0;
    let asleepSec = null;
    if (sleepDuration != null) {
      if (awakeSec && awakeSec > 0 && sleepDuration >= awakeSec) {
        asleepSec = sleepDuration - awakeSec;
      } else {
        asleepSec = sleepDuration;
      }
    }
    if (
      (asleepSec == null || asleepSec === 0) &&
      sleep.deep_sleep_seconds != null &&
      sleep.light_sleep_seconds != null &&
      sleep.rem_sleep_seconds != null
    ) {
      asleepSec =
        Number(sleep.deep_sleep_seconds || 0) +
        Number(sleep.light_sleep_seconds || 0) +
        Number(sleep.rem_sleep_seconds || 0);
    }
    if (asleepSec != null && asleepSec === 0) {
      if (sleepDuration != null && sleepDuration > 0) {
        asleepSec = sleepDuration;
      }
    }
    let denom = null;
    if (tibSec && tibSec > 0) denom = tibSec;
    else if (sleepDuration && sleepDuration > 0) denom = sleepDuration;
    if (asleepSec != null && denom != null && denom > 0) {
      let eff = (Number(asleepSec) / Number(denom)) * 100;
      eff = Math.max(0, Math.min(100, Math.round(eff * 10) / 10));
      if (
        eff === 100 &&
        tibSec &&
        sleepDuration != null &&
        Math.abs(tibSec - sleepDuration) > 60
      ) {
        const numerator =
          sleep.deep_sleep_seconds ||
          sleep.light_sleep_seconds ||
          sleep.rem_sleep_seconds
            ? Number(sleep.deep_sleep_seconds || 0) +
              Number(sleep.light_sleep_seconds || 0) +
              Number(sleep.rem_sleep_seconds || 0)
            : asleepSec;
        if (numerator && tibSec > 0) {
          eff = Math.max(
            0,
            Math.min(100, Math.round((numerator / tibSec) * 1000) / 10)
          );
        }
      }
      return eff;
    }
    return null;
  };

  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'number' && key.includes('seconds')) {
      return `${Math.round(value)} sec`;
    }
    if (key.includes('date') || key.includes('ts') || key.includes('at')) {
      return fmtDate(value);
    }
    if (typeof value === 'number' && key.includes('pct')) {
      return `${value}%`;
    }
    return String(value);
  };
  
  const moreDetailsOrder = [
    'created_at',
    'day',
    'sleep_id',
    'sleep_quality',
    'nap_duration_seconds',
    'awake_count',
    'awake_pct',
    'deep_sleep_pct',
    'light_sleep_pct',
    'rem_sleep_pct',
    'sleep_duration_seconds',
    'avg_sleep_stress',
    'avg_hr',
    'avg_respiration',
    'avg_spo2',
    'highest_spo2',
    'lowest_spo2',
    'sleep_need_actual',
    'sleep_need_baseline',
  ];

  const dynamicMoreDetails = moreDetailsOrder
    .filter(key => sleep[key] !== undefined && sleep[key] !== null)
    .map(key => ({
      key: formatKey(key),
      value: formatValue(key, sleep[key])
    }));


  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">😴</span>
            Sleep Detail
          </h1>
          <p className="page-subtitle">
            {sleep.sleep_start ? new Date(sleep.sleep_start).toLocaleString() : ''} — {sleep.sleep_end ? new Date(sleep.sleep_end).toLocaleString() : ''}
          </p>
        </div>
        <div className="header-controls items-center">
          <div className="liquid-badge mr-4" title="Sleep score">
            <div className="sessions-count text-sm">
              Score: <span style={{ fontWeight: 700 }}>{fmt(sleep.sleep_score)}</span>
            </div>
          </div>
          <Link to="/sleeps" className="liquid-button prev">
            ← Back
          </Link>
        </div>
      </div>

      <div className="page-content grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Summary</h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">
              Key numbers for this sleep session
            </p>
          </div>
          <div className="card-content">
            <ul className="space-y-2">
              <li>
                <strong>Score:</strong>{' '}
                <span
                  className={
                    sleep.sleep_score != null ? scoreClass : ''
                  }
                >
                  {fmt(sleep.sleep_score)}
                </span>
              </li>
              <li>
                <strong>Duration:</strong>{' '}
                {sleep.sleep_duration_seconds != null
                  ? formatDuration(sleep.sleep_duration_seconds, 'seconds')
                  : sleep.duration_min != null
                  ? formatDuration(sleep.duration_min, 'minutes')
                  : '-'}
              </li>
              <li>
                <strong>Efficiency:</strong>{' '}
                {fmtEff(computeEfficiency())}
              </li>
              <li>
                <strong>Deep:</strong>{' '}
                {formatDuration(sleep.deep_sleep_seconds, 'seconds')}
              </li>
              <li>
                <strong>Light:</strong>{' '}
                {formatDuration(sleep.light_sleep_seconds, 'seconds')}
              </li>
              <li>
                <strong>REM:</strong>{' '}
                {formatDuration(sleep.rem_sleep_seconds, 'seconds')}
              </li>
              <li>
                <strong>Awake:</strong>{' '}
                {formatDuration(sleep.awake_seconds, 'seconds')}
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sleep Structure</h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">
              Distribution of sleep phases
            </p>
          </div>
          <div className="card-content">
            <div style={{ maxWidth: 380, margin: '0 auto' }}>
              <Doughnut
                data={{
                  labels: ['Deep', 'Light', 'REM', 'Awake'],
                  datasets: [
                    {
                      label: 'Minutes',
                      data: [
                        sleep.deep_sleep_seconds,
                        sleep.light_sleep_seconds,
                        sleep.rem_sleep_seconds,
                        sleep.awake_seconds
                      ].map((v) => (v ? Math.round(v / 60) : 0)),
                      // Match Sleep.js phase palette for consistency
                      backgroundColor: [
                        '#8b5cf6', // Deep
                        '#22c55e', // Light
                        '#06b6d4', // REM
                        '#ef4444'  // Awake
                      ],
                      borderColor: [
                        '#7c3aed', // Deep (darker)
                        '#16a34a', // Light (darker)
                        '#0891b2', // REM (darker)
                        '#dc2626'  // Awake (darker)
                      ],
                      borderWidth: 1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          // ctx.raw is minutes here (we mapped seconds -> minutes above)
                          try {
                            const mins = Number(ctx.raw);
                            return `${ctx.label}: ${formatDuration(mins, 'minutes')}`;
                          } catch (e) {
                            return `${ctx.label}: ${ctx.raw} min`;
                          }
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="card md:col-span-2">
          <div className="card-header">
            <h3 className="card-title">Sleep Stages</h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">
              Phases of sleep over time (Hypnogram)
            </p>
          </div>
          <div className="card-content">
            {!hasEventData ? (
              <div className="text-gray-500">
                No sleep stage data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={sleepStageData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[domainStart, domainEnd]}
                    tickFormatter={formatTimeLabel}
                    />
                  <YAxis
                    type="number"
                    domain={[0.5, 4.5]}
                    ticks={[1, 2, 3, 4]}
                    tickFormatter={valueToStage}
                    />
                  <RTooltip content={<CustomStageTooltip />} />
                  <Line
                    type="stepAfter"
                    dataKey="stage"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                    {events.map((e, i) => (
                      <ReferenceArea
                        key={`stage-${i}`}
                        x1={e.t1}
                        x2={e.t2}
                        y1={0.5}
                        y2={4.5}
                        strokeOpacity={0}
                        fill={stageFill(e.event)}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-header">
            <h3 className="card-title">
              During Sleep: Heart Rate, Stress, Respiratory Rate
            </h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">
              Per-minute signals within your sleep window
            </p>
          </div>
          <div className="card-content">
            {!hasChartData ? (
              <div className="text-gray-500">No per-minute monitoring data available.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {/* HR */}
                  <div>
                    <div className="text-sm mb-2">Heart Rate (bpm)</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} syncId="sleepSync">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[domainStart, domainEnd]} tickFormatter={formatTimeLabel} />
                        <YAxis domain={["dataMin-5", "dataMax+5"]} />
                        <RTooltip content={<CustomTooltip />} />
                        {events.map((e, i) => (
                          <ReferenceArea key={`hr-${i}`} x1={e.t1} x2={e.t2} y1={'dataMin'} y2={'dataMax'} strokeOpacity={0} fill={stageFill(e.event)} />
                        ))}
                        <Line type="monotone" dataKey="hr" stroke="#ef4444" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stress */}
                  <div>
                    <div className="text-sm mb-2">Stress</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} syncId="sleepSync">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[domainStart, domainEnd]} tickFormatter={formatTimeLabel} />
                        <YAxis domain={["dataMin - 10", "dataMax + 10"]} />
                        <RTooltip content={<CustomTooltip />} />
                        {events.map((e, i) => (
                          <ReferenceArea key={`stress-${i}`} x1={e.t1} x2={e.t2} y1={'dataMin'} y2={'dataMax'} strokeOpacity={0} fill={stageFill(e.event)} />
                        ))}
                        <Line type="monotone" dataKey="stress" stroke="#0ea5e9" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* RR */}
                  <div>
                    <div className="text-sm mb-2">Respiratory Rate (breaths/min)</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} syncId="sleepSync">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[domainStart, domainEnd]} tickFormatter={formatTimeLabel} />
                        <YAxis domain={["dataMin-2", "dataMax+2"]} />
                        <RTooltip content={<CustomTooltip />} />
                        {events.map((e, i) => (
                          <ReferenceArea key={`rr-${i}`} x1={e.t1} x2={e.t2} y1={'dataMin'} y2={'dataMax'} strokeOpacity={0} fill={stageFill(e.event)} />
                        ))}
                        <Line type="monotone" dataKey="rr" stroke="#10b981" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-header">
            <h3 className="card-title">More Details</h3>
            <p className="card-subtitle text-gray-600 dark:text-gray-300">
              Additional sleep session information
            </p>
          </div>
          <div className="card-content">
            <ul className="space-y-2 text-sm">
              {dynamicMoreDetails.map((item, index) => (
                <li key={index}>
                  <strong>{item.key}:</strong> {item.value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SleepDetail;