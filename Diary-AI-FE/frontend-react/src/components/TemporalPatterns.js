import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

const TemporalPatterns = ({ data }) => {
  // State for metric selection & normalization
  const [selectedMetrics, setSelectedMetrics] = useState(['steps', 'mood', 'energy', 'sleep']);
  const [dynamicStepNorm, setDynamicStepNorm] = useState(true);
  const [segmentMode, setSegmentMode] = useState('weekday_weekend'); // 'weekday_weekend' | 'early_late' | 'work_vs_fri_weekend'

  const allMetrics = [
    { key: 'steps', label: 'Steps', max: 15000 },
    { key: 'mood', label: 'Mood (/5)', max: 5 },
    { key: 'energy', label: 'Energy (/5)', max: 5 },
    { key: 'sleep', label: 'Sleep (/100)', max: 100 }
  ];

  function toggleMetric(metric) {
    setSelectedMetrics(prev => prev.includes(metric)
      ? prev.filter(m => m !== metric)
      : [...prev, metric]);
  }

  const temporalData = useMemo(() => {
    if (!data) return null;
    // Support both shapes: { patterns: {...} } or direct fields on root
    const root = data.patterns ? data.patterns : data;
    if (!root || (typeof root !== 'object')) return null;

    const dayOfWeekPatterns = root.day_of_week_patterns || root.dayOfWeekPatterns || {};
    const weeklyTrends = root.weekly_trends || root.weeklyTrends || {};
    const insights = root.insights || [];

    // Process day of week data
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayOfWeekData = dayNames.map(day => {
      const dayData = dayOfWeekPatterns[day] || {};
      return {
        day,
        shortDay: day.slice(0, 3),
        steps: dayData.steps?.mean || 0,
        mood: dayData.mood?.mean || 0,
        energy: dayData.energy_level?.mean || 0,
        sleep: dayData.sleep_score?.mean || 0,
        stepCount: dayData.steps?.count || 0,
        moodCount: dayData.mood?.count || 0
      };
    });

    // Process weekly trends
    let weeklyData = [];
    try {
      weeklyData = Object.entries(weeklyTrends)
        .map(([week, metrics]) => ({
          week: parseInt(week, 10),
          steps: metrics?.steps ?? 0,
          mood: metrics?.mood ?? 0,
          energy: metrics?.energy_level ?? metrics?.energy ?? 0
        }))
        .filter(r => !Number.isNaN(r.week))
        .sort((a, b) => b.week - a.week)
        .slice(0, 8);
    } catch (e) {
      console.warn('Failed to parse weekly trends', e);
    }

    return {
      dayOfWeekData,
      weeklyData,
      insights,
      bestDay: insights.find(i => i.includes('Best wellbeing day')),
      worstDay: insights.find(i => i.includes('Most challenging day')),
      mostActiveDay: insights.find(i => i.includes('Most active day')),
      leastActiveDay: insights.find(i => i.includes('Least active day'))
    };
  }, [data]);

  // If no temporalData we'll render an empty state later; keep hooks consistent across renders.

  // Unified tooltip component used across all charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    // Helper to format numbers based on metric key
    const formatValue = (val, key) => {
      if (val == null || isNaN(val)) return '-';
      // Percentage change field naming: pct or percent
      if (key === 'pct' || key === 'percent') return `${val.toFixed(1)}%`;
      // Diff keep one or zero decimals depending on magnitude
      if (key === 'diff') return Math.abs(val) >= 10 ? Math.round(val) : val.toFixed(2);
      if (key === 'steps') return Math.round(val).toLocaleString();
      if (key === 'sleep') return `${val.toFixed(0)}`;
      if (key === 'mood' || key === 'energy') return val.toFixed(2);
      // Moving averages keys end with MA
      if (/MA$/.test(key)) {
        if (key.startsWith('steps')) return Math.round(val).toLocaleString();
        return val.toFixed(2);
      }
      return typeof val === 'number' && Math.abs(val) >= 100 ? Math.round(val) : val.toFixed ? val.toFixed(2) : val;
    };

    // Provide nicer label formatting (Week -> Week N, else reuse)
    const prettyLabel = () => {
      if (/^\d+$/.test(label)) return `Week ${label}`;
      return label;
    };

    return (
      <div className="custom-tooltip unified">
        <div className="tooltip-header">{prettyLabel()}</div>
        <div className="tooltip-body">
          {payload.map((entry, idx) => {
            const key = entry.dataKey || entry.name;
            const unit = getMetricUnit(key);
            const displayName = getMetricDisplayName(key);
            return (
              <div key={idx} className="tooltip-row">
                <span className="dot" style={{ backgroundColor: entry.color || '#64748b' }} />
                <span className="metric-name">{displayName}</span>
                <span className="metric-value">{formatValue(entry.value, key)}{unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  function getMetricUnit(metric) {
    const units = {
      steps: '',
      mood: '/5',
      energy: '/5',
      sleep: '/100'
    };
    return units[metric] || '';
  }

  function getMetricColor(metric) {
    const colors = {
      steps: '#10b981',
      mood: '#f59e0b',
      energy: '#3b82f6',
      sleep: '#8b5cf6'
    };
    return colors[metric] || '#64748b';
  }

  function getMetricDisplayName(key) {
    const map = {
      steps: 'Steps',
      stepsMA: 'Steps (3w MA)',
      mood: 'Mood',
      moodMA: 'Mood (3w MA)',
      energy: 'Energy',
      energyMA: 'Energy (3w MA)',
      sleep: 'Sleep Score',
      diff: 'Diff',
      pct: '% Change',
      percent: '% Change'
    };
    return map[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
  }

  // Determine dynamic max for steps (if enabled)
  const maxSteps = useMemo(() => {
    if (!temporalData) return 15000;
    const maxVal = Math.max(...temporalData.dayOfWeekData.map(d => d.steps || 0));
    return dynamicStepNorm ? (maxVal === 0 ? 15000 : maxVal) : 15000;
  }, [temporalData, dynamicStepNorm]);

  // Prepare radar chart data using selected metrics
  const radarData = temporalData.dayOfWeekData.map(day => {
    const row = { day: day.shortDay };
    if (selectedMetrics.includes('steps')) row.steps = (day.steps / maxSteps) * 100;
    if (selectedMetrics.includes('mood')) row.mood = (day.mood / 5) * 100;
    if (selectedMetrics.includes('energy')) row.energy = (day.energy / 5) * 100;
    if (selectedMetrics.includes('sleep')) row.sleep = day.sleep; // already 0-100
    return row;
  });

  // Correlation matrix (Pearson) across days using dayOfWeekData
  const correlationMatrix = useMemo(() => {
    const metrics = selectedMetrics.slice();
    if (metrics.length < 2) return null;
    const rows = {};
    const valuesByMetric = metrics.reduce((acc, m) => {
      acc[m] = temporalData.dayOfWeekData.map(d => d[m] || 0);
      return acc;
    }, {});

    function pearson(a, b) {
      const n = a.length;
      if (n !== b.length || n === 0) return 0;
      const meanA = a.reduce((s,v)=>s+v,0)/n;
      const meanB = b.reduce((s,v)=>s+v,0)/n;
      let num = 0; let denomA = 0; let denomB = 0;
      for (let i=0;i<n;i++) {
        const da = a[i]-meanA; const db = b[i]-meanB;
        num += da*db; denomA += da*da; denomB += db*db;
      }
      const denom = Math.sqrt(denomA*denomB);
      if (denom === 0) return 0;
      return num/denom;
    }

    metrics.forEach(m1 => {
      rows[m1] = {};
      metrics.forEach(m2 => {
        if (m1 === m2) rows[m1][m2] = 1;
        else rows[m1][m2] = pearson(valuesByMetric[m1], valuesByMetric[m2]);
      });
    });
    return { metrics, rows };
  }, [selectedMetrics, temporalData]);

  function corrColor(v) {
    // v in [-1,1]; negative -> red, positive -> green
    const clamp = Math.max(-1, Math.min(1, v));
    if (clamp >= 0) {
      const g = Math.round(180 + 75*clamp); // 180..255
      const r = Math.round(255 - 120*clamp); // 255..135
      return `rgba(${r},${g},180,0.6)`;
    } else {
      const pos = Math.abs(clamp);
      const r = Math.round(180 + 75*pos); // 180..255
      const g = Math.round(255 - 120*pos); // 255..135
      return `rgba(${r},${g},180,0.6)`;
    }
  }

  function interpretCorrelation(v) {
    const abs = Math.abs(v);
    let strength;
    if (abs >= 0.9) strength = 'very strong';
    else if (abs >= 0.7) strength = 'strong';
    else if (abs >= 0.5) strength = 'moderate';
    else if (abs >= 0.3) strength = 'weak';
    else if (abs >= 0.1) strength = 'very weak';
    else strength = 'negligible';
    const direction = v > 0 ? 'positive' : v < 0 ? 'negative' : 'no';
    return `${strength} ${direction === 'no' ? '' : direction + ' '}correlation (r = ${v.toFixed(2)})`;
  }

  // Heatmap data preparation
  const heatmapMetrics = useMemo(() => ['steps', 'mood', 'energy', 'sleep'], []);
  const heatmapStats = useMemo(() => {
    const stats = {};
    heatmapMetrics.forEach(m => {
      const values = temporalData.dayOfWeekData.map(d => d[m] || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      stats[m] = { min, max, range: max - min || 1 };
    });
    return stats;
  }, [temporalData, heatmapMetrics]);

  function heatColor(metric, value) {
    const { min, range } = heatmapStats[metric];
    const ratio = (value - min) / range; // 0..1
    // Gradient from light to vivid metric color
    const base = getMetricColor(metric);
    // Convert hex to rgb
    const r = parseInt(base.slice(1,3),16);
    const g = parseInt(base.slice(3,5),16);
    const b = parseInt(base.slice(5,7),16);
    const bg = `rgba(${r},${g},${b},${0.15 + ratio * 0.65})`;
    return bg;
  }

  // Segmentation aggregation (generalized)
  const segmentComparison = useMemo(() => {
    if (!temporalData) return [];
    const days = temporalData.dayOfWeekData;
    const dayMap = Object.fromEntries(days.map(d => [d.shortDay, d]));

    // Define segment groups
    let segments = [];
    if (segmentMode === 'weekday_weekend') {
      segments = [
        { key: 'segA', label: 'Weekdays (Mon–Fri)', days: ['Mon','Tue','Wed','Thu','Fri'] },
        { key: 'segB', label: 'Weekend (Sat–Sun)', days: ['Sat','Sun'] }
      ];
    } else if (segmentMode === 'early_late') {
      segments = [
        { key: 'segA', label: 'Early Week (Mon–Wed)', days: ['Mon','Tue','Wed'] },
        { key: 'segB', label: 'Late Week (Thu–Sun)', days: ['Thu','Fri','Sat','Sun'] }
      ];
    } else if (segmentMode === 'work_vs_fri_weekend') {
      segments = [
        { key: 'segA', label: 'Workdays (Mon–Thu)', days: ['Mon','Tue','Wed','Thu'] },
        { key: 'segB', label: 'Fri + Weekend', days: ['Fri','Sat','Sun'] }
      ];
    }

    function avgDays(dayCodes, metric) {
      const list = dayCodes.map(c => dayMap[c]).filter(Boolean);
      if (!list.length) return 0;
      return list.reduce((s,r)=>s+(r[metric]||0),0)/list.length;
    }
    function pctChange(a,b) { if (b === 0) return 0; return ((a - b)/Math.abs(b))*100; }

    const metrics = ['steps','mood','energy','sleep'];
    return metrics.map(m => {
      const a = avgDays(segments[0].days, m);
      const b = avgDays(segments[1].days, m);
      return {
        metric: m,
        label: m.charAt(0).toUpperCase()+m.slice(1),
        segALabel: segments[0].label,
        segBLabel: segments[1].label,
        segA: a,
        segB: b,
        diff: a - b,
        pct: pctChange(a,b)
      };
    });
  }, [temporalData, segmentMode]);

  const diffBarData = useMemo(() => {
    return segmentComparison
      .filter(r => selectedMetrics.includes(r.metric))
      .map(r => ({
        metric: r.label,
        diff: Number(r.diff.toFixed(2)),
        pct: Number(r.pct.toFixed(2))
      }));
  }, [segmentComparison, selectedMetrics]);

  if (!temporalData) {
    return (
      <div className="temporal-empty">
        <div className="empty-icon">📅</div>
        <div className="empty-text">No temporal pattern data available</div>
      </div>
    );
  }

  return (
    <div className="temporal-patterns">
      {/* Controls */}
      <div className="temporal-controls">
        <div className="metric-toggles">
          {allMetrics.map(m => (
            <label key={m.key} className={`metric-toggle ${selectedMetrics.includes(m.key) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={selectedMetrics.includes(m.key)}
                onChange={() => toggleMetric(m.key)}
              />
              <span className="color-dot" style={{ backgroundColor: getMetricColor(m.key) }} />
              {m.label}
            </label>
          ))}
        </div>
        <div className="normalization-toggle">
          <label>
            <input
              type="checkbox"
              checked={dynamicStepNorm}
              onChange={() => setDynamicStepNorm(v => !v)}
            />
            Dynamic Steps Normalization (max = {dynamicStepNorm ? maxSteps.toLocaleString() : '15,000'})
          </label>
        </div>
        <div className="segmentation-toggle">
          <select value={segmentMode} onChange={e => setSegmentMode(e.target.value)}>
            <option value="weekday_weekend">Weekday vs Weekend</option>
            <option value="early_late">Early vs Late Week</option>
            <option value="work_vs_fri_weekend">Workdays vs Fri+Weekend</option>
          </select>
        </div>
      </div>

      {/* Insights Overview */}
      <div className="insights-overview">
        <h4>Key Temporal Insights</h4>
        <div className="insight-cards">
          {temporalData.insights.map((insight, index) => (
            <div key={index} className="insight-card">
              <div className="insight-icon">
                {insight.includes('Best') ? '🌟' : 
                 insight.includes('challenging') ? '⚠️' : 
                 insight.includes('active') ? '🏃' : '📊'}
              </div>
              <div className="insight-text">{insight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Day of Week Analysis */}
      <div className="day-of-week-section">
        <h4>Day of Week Patterns</h4>
        
        {/* Bar Charts for Different Metrics */}
        <div className="metric-charts">
          {selectedMetrics.includes('steps') && (
            <div className="metric-chart">
              <h5>Daily Steps Pattern</h5>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={temporalData.dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="shortDay" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="steps" fill={getMetricColor('steps')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(selectedMetrics.includes('mood') || selectedMetrics.includes('energy')) && (
            <div className="metric-chart">
              <h5>Mood & Energy Pattern</h5>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={temporalData.dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="shortDay" fontSize={12} />
                  <YAxis domain={[0, 5]} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  {selectedMetrics.includes('mood') && (
                    <Bar dataKey="mood" fill={getMetricColor('mood')} radius={[2, 2, 0, 0]} />
                  )}
                  {selectedMetrics.includes('energy') && (
                    <Bar dataKey="energy" fill={getMetricColor('energy')} radius={[2, 2, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedMetrics.includes('sleep') && (
            <div className="metric-chart">
              <h5>Sleep Score Pattern</h5>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={temporalData.dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="shortDay" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sleep" fill={getMetricColor('sleep')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Radar Chart for Overall Pattern */}
      <div className="radar-section">
        <h4>Weekly Health Pattern Overview</h4>
        <div className="radar-container">
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="day" fontSize={12} />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                fontSize={10}
                tickCount={5}
              />
              {selectedMetrics.includes('steps') && (
                <Radar
                  name="Steps"
                  dataKey="steps"
                  stroke={getMetricColor('steps')}
                  fill={getMetricColor('steps')}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.includes('mood') && (
                <Radar
                  name="Mood"
                  dataKey="mood"
                  stroke={getMetricColor('mood')}
                  fill={getMetricColor('mood')}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.includes('energy') && (
                <Radar
                  name="Energy"
                  dataKey="energy"
                  stroke={getMetricColor('energy')}
                  fill={getMetricColor('energy')}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.includes('sleep') && (
                <Radar
                  name="Sleep"
                  dataKey="sleep"
                  stroke={getMetricColor('sleep')}
                  fill={getMetricColor('sleep')}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          
          <div className="radar-legend">
            {selectedMetrics.includes('steps') && (
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: getMetricColor('steps') }}></div>
                <span>Steps (normalized)</span>
              </div>
            )}
            {selectedMetrics.includes('mood') && (
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: getMetricColor('mood') }}></div>
                <span>Mood (/5)</span>
              </div>
            )}
            {selectedMetrics.includes('energy') && (
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: getMetricColor('energy') }}></div>
                <span>Energy (/5)</span>
              </div>
            )}
            {selectedMetrics.includes('sleep') && (
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: getMetricColor('sleep') }}></div>
                <span>Sleep Score (/100)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Trends */}
      {temporalData.weeklyData.length > 0 && (
        <div className="weekly-trends-section">
          <h4>Weekly Trends (Last 8 Weeks)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={(function(){
              // produce data with moving averages
              const src = [...temporalData.weeklyData].reverse(); // chronological ascending
              const withMA = src.map((row, idx) => {
                const slice = src.slice(Math.max(0, idx-2), idx+1); // last up to 3
                const ma = (key) => slice.reduce((s,r)=>s+(r[key]||0),0)/slice.length;
                return {
                  ...row,
                  stepsMA: ma('steps'),
                  moodMA: ma('mood'),
                  energyMA: ma('energy')
                };
              });
              return withMA;
            })()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="week" 
                fontSize={12}
                tickFormatter={(week) => `W${week}`}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                labelFormatter={(week) => `Week ${week}`}
                content={<CustomTooltip />}
              />
              {selectedMetrics.includes('steps') && (
                <Line
                  type="monotone"
                  dataKey="steps"
                  stroke={getMetricColor('steps')}
                  strokeWidth={3}
                  dot={{ fill: getMetricColor('steps'), strokeWidth: 2, r: 4 }}
                  name="Steps"
                />
              )}
              {selectedMetrics.includes('steps') && (
                <Line
                  type="monotone"
                  dataKey="stepsMA"
                  stroke={getMetricColor('steps')}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Steps (3w MA)"
                />
              )}
              {selectedMetrics.includes('mood') && (
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke={getMetricColor('mood')}
                  strokeWidth={3}
                  dot={{ fill: getMetricColor('mood'), strokeWidth: 2, r: 4 }}
                  name="Mood"
                />
              )}
              {selectedMetrics.includes('mood') && (
                <Line
                  type="monotone"
                  dataKey="moodMA"
                  stroke={getMetricColor('mood')}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Mood (3w MA)"
                />
              )}
              {selectedMetrics.includes('energy') && (
                <Line
                  type="monotone"
                  dataKey="energy"
                  stroke={getMetricColor('energy')}
                  strokeWidth={3}
                  dot={{ fill: getMetricColor('energy'), strokeWidth: 2, r: 4 }}
                  name="Energy"
                />
              )}
              {selectedMetrics.includes('energy') && (
                <Line
                  type="monotone"
                  dataKey="energyMA"
                  stroke={getMetricColor('energy')}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Energy (3w MA)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Day Statistics Table */}
      <div className="day-stats-table">
        <h4>Detailed Day Statistics</h4>
        <div className="table-container">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Avg Steps</th>
                <th>Avg Mood</th>
                <th>Avg Energy</th>
                <th>Avg Sleep</th>
                <th>Data Points</th>
              </tr>
            </thead>
            <tbody>
              {temporalData.dayOfWeekData.map((day, index) => (
                <tr key={index}>
                  <td className="day-name">{day.day}</td>
                  <td>{day.steps.toLocaleString()}</td>
                  <td>{day.mood.toFixed(1)}/5</td>
                  <td>{day.energy.toFixed(1)}/5</td>
                  <td>{day.sleep.toFixed(0)}/100</td>
                  <td>{day.stepCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segment Comparison */}
      <div className="weekday-weekend-section">
        <h4>Segment Comparison</h4>
        <div className="ww-table-wrapper">
          <table className="ww-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{segmentComparison[0]?.segALabel || 'Segment A'}</th>
                <th>{segmentComparison[0]?.segBLabel || 'Segment B'}</th>
                <th>Diff (A - B)</th>
                <th>% Change</th>
              </tr>
            </thead>
            <tbody>
              {segmentComparison.filter(r => selectedMetrics.includes(r.metric)).map(r => (
                <tr key={r.metric}>
                  <td className="metric-name">{r.label}</td>
                  <td>{r.metric === 'steps' ? Math.round(r.segA).toLocaleString() : r.metric === 'sleep' ? r.segA.toFixed(0) : r.segA.toFixed(2)}</td>
                  <td>{r.metric === 'steps' ? Math.round(r.segB).toLocaleString() : r.metric === 'sleep' ? r.segB.toFixed(0) : r.segB.toFixed(2)}</td>
                  <td className={r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}>
                    {r.metric === 'steps' ? Math.round(r.diff).toLocaleString() : r.metric === 'sleep' ? r.diff.toFixed(0) : r.diff.toFixed(2)}
                  </td>
                  <td className={r.pct > 0 ? 'pos' : r.pct < 0 ? 'neg' : ''}>{r.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ww-hint">Diff = Segment A minus Segment B. % Change = (A - B) / |B| * 100.</div>
      </div>

      {/* Difference Bar Chart */}
      {diffBarData.length > 0 && (
        <div className="diff-bar-section">
          <h4>Segment Differences (Absolute & %)</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={diffBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="metric" fontSize={12} />
              <YAxis yAxisId="left" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} domain={[dataMin => Math.min(-100, dataMin), dataMax => Math.max(100, dataMax)]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="diff" name="Diff" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="pct" name="% Change" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap */}
      <div className="heatmap-section">
        <h4>Day-of-Week Heatmap</h4>
        <div className="heatmap-wrapper">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th>Metric</th>
                {temporalData.dayOfWeekData.map(d => (
                  <th key={d.day}>{d.shortDay}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapMetrics.filter(m => selectedMetrics.includes(m)).map(metric => (
                <tr key={metric}>
                  <td className="metric-name">{metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                  {temporalData.dayOfWeekData.map(d => (
                    <td
                      key={d.day + metric}
                      className="heat-cell"
                      style={{ background: heatColor(metric, d[metric] || 0) }}
                    >
                      <span className="cell-value">
                        {metric === 'mood' || metric === 'energy' ? d[metric].toFixed(1) : metric === 'sleep' ? d[metric].toFixed(0) : d[metric].toLocaleString()}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="heatmap-hint">Color intensity indicates relative value per metric across days (min to max).</div>
      </div>

      {/* Correlation Matrix */}
      {correlationMatrix && (
        <div className="correlation-section">
          <h4>Metric Correlation (Pearson)</h4>
            <div className="correlation-wrapper">
              <table className="correlation-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {correlationMatrix.metrics.map(m => (
                      <th key={m}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlationMatrix.metrics.map(rowM => (
                    <tr key={rowM}>
                      <td className="metric-name">{rowM}</td>
                      {correlationMatrix.metrics.map(colM => {
                        const val = correlationMatrix.rows[rowM][colM];
                        return (
                          <td key={rowM+colM} className="corr-cell" style={{ background: corrColor(val) }} title={interpretCorrelation(val)}>
                            <span className="cell-value">{val.toFixed(2)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="correlation-hint">Green = positive correlation, Red = negative, 1 = perfect.</div>
        </div>
      )}

      <style jsx>{`
        :root {
          --c-bg: #ffffff;
          --c-bg-subtle: #f8fafc;
          --c-bg-accent: #f0f9ff;
          --c-bg-elevated: #ffffff;
          --c-border: #e2e8f0;
          --c-border-muted: #cbd5e1;
          --c-text: #1e293b;
          --c-text-muted: #64748b;
          --c-text-soft: #334155;
          --c-primary: #3b82f6;
          --c-primary-strong: #1e3a8a;
          --c-radius-sm: 4px;
          --c-radius: 8px;
          --c-radius-lg: 12px;
          --fs-2xs: 0.65rem;
          --fs-xs: 0.7rem;
          --fs-sm: 0.75rem;
          --fs-base: 0.875rem;
          --fs-md: 1rem;
          --fs-lg: 1.1rem;
          --fs-xl: 1.25rem;
        }
        .dark :root, :root.dark {
          --c-bg: #0f172a;
          --c-bg-subtle: #1e293b;
            --c-bg-accent: #1e3a8a;
          --c-bg-elevated: #1e293b;
          --c-border: #334155;
          --c-border-muted: #475569;
          --c-text: #f1f5f9;
          --c-text-muted: #94a3b8;
          --c-text-soft: #cbd5e1;
          --c-primary: #60a5fa;
          --c-primary-strong: #1e3a8a;
        }
        .temporal-patterns {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .temporal-controls { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--c-bg-subtle); border: 1px solid var(--c-border); border-radius: var(--c-radius-lg); }

        .dark .temporal-controls { background: var(--c-bg-subtle); border-color: var(--c-border); }

        .metric-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .metric-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--c-bg-elevated); border: 1px solid var(--c-border); border-radius: var(--c-radius); font-size: var(--fs-sm); font-weight: 500; cursor: pointer; user-select: none; transition: all 0.15s ease; }

        .metric-toggle.active { background: #eff6ff; border-color: var(--c-primary); color: var(--c-primary-strong); }

        .dark .metric-toggle { background: var(--c-bg); border-color: var(--c-border); color: var(--c-text); }

        .dark .metric-toggle.active { background: var(--c-primary-strong); border-color: var(--c-primary); color: var(--c-text); }

        .metric-toggle input { display: none; }

        .color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.6);
        }

        .normalization-toggle { font-size: var(--fs-sm); font-weight: 500; display: flex; align-items: center; gap: 8px; color: var(--c-text-soft); }

        .dark .normalization-toggle { color: #cbd5e1; }

  .segmentation-toggle select { padding: 6px 8px; border-radius: var(--c-radius); border: 1px solid var(--c-border-muted); background: var(--c-bg-elevated); font-size: var(--fs-xs); font-weight: 500; }
  .dark .segmentation-toggle select { background: #0f172a; color: #e2e8f0; border-color: #334155; }
  .export-actions { margin-left: auto; display: flex; align-items: center; }

        .temporal-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #64748b;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 1rem;
          font-weight: 500;
        }

        .insights-overview h4,
        .day-of-week-section h4,
        .radar-section h4,
        .weekly-trends-section h4,
        .day-stats-table h4 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .dark .insights-overview h4,
        .dark .day-of-week-section h4,
        .dark .radar-section h4,
        .dark .weekly-trends-section h4,
        .dark .day-stats-table h4 {
          color: #f1f5f9;
        }

        .insight-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .insight-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--c-bg-accent); border-left: 4px solid var(--c-primary); border-radius: 0 var(--c-radius) var(--c-radius) 0; }

        .dark .insight-card {
          background: #1e3a8a;
          border-left-color: #60a5fa;
        }

        .insight-icon {
          font-size: 1.25rem;
        }

        .insight-text { flex: 1; color: var(--c-text); font-size: var(--fs-base); font-weight: 500; }

        .dark .insight-text {
          color: #f1f5f9;
        }

        .metric-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .metric-chart h5 { font-size: var(--fs-md); font-weight: 600; color: #374151; margin: 0 0 12px 0; text-align: center; }

        .dark .metric-chart h5 {
          color: #d1d5db;
        }

        .radar-section { background: var(--c-bg-subtle); padding: 24px; border-radius: var(--c-radius-lg); }

        .dark .radar-section {
          background: #334155;
        }

        .radar-container {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .radar-legend {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .legend-item span { font-size: var(--fs-base); color: #374151; }

        .dark .legend-item span {
          color: #d1d5db;
        }

        .table-container {
          overflow-x: auto;
        }

        .stats-table { width: 100%; border-collapse: collapse; background: var(--c-bg-elevated); border-radius: var(--c-radius); overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        .dark .stats-table {
          background: #1e293b;
        }

        .stats-table th,
        .stats-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .stats-table th,
        .dark .stats-table td {
          border-bottom-color: #334155;
        }

        .stats-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #374151;
          font-size: 0.875rem;
        }

        .dark .stats-table th {
          background: #334155;
          color: #d1d5db;
        }

        .stats-table td {
          color: #1e293b;
          font-size: 0.875rem;
        }

        .dark .stats-table td {
          color: #f1f5f9;
        }

        .day-name {
          font-weight: 600;
        }

        .heatmap-section h4 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

  .weekday-weekend-section h4 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0 0 12px 0; }
  .dark .weekday-weekend-section h4 { color: #f1f5f9; }
        .ww-table-wrapper { overflow-x: auto; }
        .ww-table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; }
        .dark .ww-table { background: #1e293b; }
        .ww-table th, .ww-table td { padding: 10px 14px; font-size: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: left; }
        .dark .ww-table th, .dark .ww-table td { border-bottom: 1px solid #334155; }
        .ww-table th { background: #f8fafc; font-weight: 600; color: #334155; }
        .dark .ww-table th { background: #334155; color: #e2e8f0; }
        .ww-table td.pos { color: #047857; font-weight: 600; }
        .ww-table td.neg { color: #b91c1c; font-weight: 600; }
        .dark .ww-table td.pos { color: #10b981; }
        .dark .ww-table td.neg { color: #f87171; }
        .ww-hint { margin-top: 6px; font-size: 0.65rem; color: #64748b; }
        .dark .ww-hint { color: #94a3b8; }
  .diff-bar-section h4 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 8px 0 12px; }
  .dark .diff-bar-section h4 { color: #f1f5f9; }

        .dark .heatmap-section h4 { color: #f1f5f9; }

        .heatmap-wrapper {
          overflow-x: auto;
        }

        .heatmap-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 2px;
        }

        .heatmap-table th, .heatmap-table td {
          padding: 6px 8px;
          text-align: center;
          font-size: 0.7rem;
          border-radius: 6px;
          background: #f1f5f9;
        }

        .dark .heatmap-table th, .dark .heatmap-table td { background: #1e293b; }

        .heatmap-table th {
          font-weight: 600;
          color: #334155;
        }

        .dark .heatmap-table th { color: #e2e8f0; }

        .heat-cell {
          position: relative;
          color: #0f172a;
        }

        .dark .heat-cell { color: #f1f5f9; }

        .cell-value { position: relative; z-index: 2; mix-blend-mode: hard-light; }

        .heatmap-hint {
          margin-top: 8px;
          font-size: 0.65rem;
          color: #64748b;
        }

        .dark .heatmap-hint { color: #94a3b8; }

        .correlation-section h4 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; }
        .dark .correlation-section h4 { color: #f1f5f9; }
        .correlation-wrapper { overflow-x: auto; }
        .correlation-table { width: 100%; border-collapse: separate; border-spacing: 2px; }
        .correlation-table th, .correlation-table td { padding: 6px 8px; text-align: center; font-size: 0.7rem; border-radius: 6px; background: #f1f5f9; }
        .dark .correlation-table th, .dark .correlation-table td { background: #1e293b; }
        .correlation-table th { font-weight: 600; color: #334155; }
        .dark .correlation-table th { color: #e2e8f0; }
        .corr-cell { position: relative; color: #0f172a; }
        .dark .corr-cell { color: #f1f5f9; }
        .correlation-hint { margin-top: 8px; font-size: 0.65rem; color: #64748b; }
        .dark .correlation-hint { color: #94a3b8; }

        .stats-table tr:hover {
          background: #f8fafc;
        }

        .dark .stats-table tr:hover {
          background: #334155;
        }

        :global(.custom-tooltip) {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: var(--glass-shadow);
          border-radius: 12px;
          padding: 12px 14px;
        }

        

        :global(.tooltip-label) {
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        :global(.dark .tooltip-label) {
          color: #f1f5f9;
        }

        :global(.tooltip-value) {
          margin: 0 0 4px 0;
          font-size: 0.875rem;
        }

        /* Unified tooltip (new) */
        .custom-tooltip.unified {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(15,23,42,0.15);
          padding: 8px 11px;
          border-radius: 10px;
          min-width: 155px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 12px; /* slightly increased */
        }
        .dark .custom-tooltip.unified {
          background: #1e293b;
          border-color: #334155;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .custom-tooltip.unified .tooltip-header {
          font-weight: 500;
          font-size: 13px; /* slightly increased */
          color: #0f172a;
          margin: 0 0 3px 0;
        }
        .dark .custom-tooltip.unified .tooltip-header { color: #f1f5f9; }
        .custom-tooltip.unified .tooltip-body { display: flex; flex-direction: column; gap: 4px; }
        .custom-tooltip.unified .tooltip-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .custom-tooltip.unified .tooltip-row .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.1); }
  .custom-tooltip.unified .tooltip-row .metric-name { flex: 1; color: #334155; font-weight: 400; }
  .dark .custom-tooltip.unified .tooltip-row .metric-name { color: #cbd5e1; }
  .custom-tooltip.unified .tooltip-row .metric-value { font-variant-numeric: tabular-nums; color: #0f172a; font-weight: 500; font-size: 11px; }
  .dark .custom-tooltip.unified .tooltip-row .metric-value { color: #f1f5f9; }

        @media (max-width: 768px) {
          .metric-charts {
            grid-template-columns: 1fr;
          }

          .temporal-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .radar-container {
            flex-direction: column;
            gap: 16px;
          }

          .radar-legend {
            flex-direction: row;
            flex-wrap: wrap;
          }

          .insight-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default TemporalPatterns;