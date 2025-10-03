import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine
} from 'recharts';
import ChartTooltip from './ui/ChartTooltip';
import { format, parseISO } from 'date-fns';

const minutesToHHmm = (m) => {
  if (m == null || isNaN(m)) return 'N/A';
  // Normalize minute-of-day using modulo so values like 1500 (25:00) wrap to 01:00
  const raw = Math.round(Number(m));
  const mm = ((raw % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60) % 24;
  const min = mm % 60;
  return `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
};

// metric config helper hoisted to module scope to keep stable reference for hooks
const defaultMetricConfig = (metric, color) => {
  const configs = {
    energy_level: {
      name: 'Energy Level',
      unit: '/5',
      color: '#3b82f6',
      domain: [0, 5]
    },
    sleep_score: {
      name: 'Sleep Score',
      unit: '/100',
      color: '#8b5cf6',
      domain: [0, 100]
    },
    steps: {
      name: 'Steps',
      unit: '',
      color: '#10b981',
      domain: [0, 'dataMax']
    },
    rhr: {
      name: 'Resting Heart Rate',
      unit: ' bpm',
      color: '#ef4444',
      domain: ['dataMin - 5', 'dataMax + 5']
    },
    mood: {
      name: 'Mood',
      unit: '/5',
      color: '#f59e0b',
      domain: [0, 5]
    },
    calories_total: {
      name: 'Calories',
      unit: ' kcal',
      color: '#ec4899',
      domain: [0, 'dataMax']
    },
    stress_avg: {
      name: 'Stress Level',
      unit: '/100',
      color: '#f97316',
      domain: [0, 100]
    }
  };
  return configs[metric] || {
    name: metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    unit: '',
    color: color,
    domain: ['dataMin', 'dataMax']
  };
};

const HealthChart = ({ 
  data = [], 
  metric = 'energy_level', 
  height = 300, 
  type = 'line',
  showGrid = true,
  showTooltip = true,
  color = '#3b82f6',
  // stacked area
  stackKeys,
  yDomain,
  // scatter
  xKey,
  yKey,
  pointColor = '#3b82f6',
  legend = false,
  // rolling average for line charts
  rollingWindow,
  raColor = '#94a3b8',
}) => {

 const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    const makeDayObj = (d) => {
      if (!d) return null;
      if (d.day && typeof d.day === 'string') return new Date(d.day);
      if (d.day && d.day.toDate) return d.day.toDate();
      // fallback if date already provided as Date in item.date
      if (d.date && typeof d.date === 'string') return new Date(d.date);
      if (d.date && d.date.toDate) return d.date.toDate();
      if (d.date instanceof Date) return d.date;
      return null;
    };

      const dowNamesShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // For stacked area charts, don't filter by a single metric. Use any of the stackKeys present.
    if (type === 'stacked-area') {
      const rows = data.map(item => {
        const dayObj = makeDayObj(item);
        const dow = dayObj ? dowNamesShort[dayObj.getDay()] : null;
        return {
          ...item,
          date: item.day || item.date,
          dayObj,
          dow,
          formattedDate: dayObj ? format(dayObj, 'MMM dd') : 'N/A'
        };
      });
      if (Array.isArray(stackKeys) && stackKeys.length > 0) {
        return rows.filter(r => stackKeys.some(k => r[k] !== null && r[k] !== undefined)).reverse();
      }
      return rows.reverse();
    }
    
    return data
      .filter(item => item[metric] !== null && item[metric] !== undefined)
      .map(item => {
        const dayObj = makeDayObj(item);
        const dow = dayObj ? dowNamesShort[dayObj.getDay()] : null;
        return {
          ...item,
          date: item.day || item.date,
          dayObj,
          dow,
          value: Number(item[metric]) || 0,
          formattedDate: dayObj ? format(dayObj, 'MMM dd') : 'N/A'
        };
      })
      .reverse(); // Show chronological order
 }, [data, metric, type, stackKeys]);

 const lineWithRolling = useMemo(() => {
   if (!rollingWindow || !chartData.length) return chartData;
   const n = Math.max(1, Math.floor(rollingWindow));
   const ra = [];
   for (let i = 0; i < chartData.length; i++) {
     const start = Math.max(0, i - n + 1);
     const slice = chartData.slice(start, i + 1);
     const avg = slice.reduce((s, r) => s + (Number(r.value) || 0), 0) / slice.length;
     ra.push({ ...chartData[i], ra: +avg.toFixed(2) });
   }
   return ra;
 }, [chartData, rollingWindow]);

  const config = defaultMetricConfig(metric, color);

  // Compute Y axis ticks for percent-style charts (0..100 step 10)
  const yTicks = React.useMemo(() => {
    try {
      // If explicit yDomain requested and covers 0..100
      if (Array.isArray(yDomain) && yDomain.length === 2) {
        const a = Number(yDomain[0]);
        const b = Number(yDomain[1]);
        if (!Number.isNaN(a) && !Number.isNaN(b) && a === 0 && b === 100) {
          return Array.from({ length: 11 }, (_, i) => i * 10);
        }
      }

      // If metric or stack keys look like percent fields, use 0..100 ticks
      if ((metric && String(metric).endsWith('_pct')) || (Array.isArray(stackKeys) && stackKeys.some(k => String(k).endsWith('_pct')))) {
        return Array.from({ length: 11 }, (_, i) => i * 10);
      }
    } catch (e) {
      // fallback to undefined
    }
    return undefined;
  }, [yDomain, metric, stackKeys]);

  // Friendly label for empty-state depending on chart type
  const emptyLabel = useMemo(() => {
    if (type === 'scatter') {
      return `${xKey || 'x'} vs ${yKey || 'y'}`;
    }
    if (type === 'stacked-area') {
      return 'Selected series';
    }
    return (defaultMetricConfig(metric, config.color)?.name) || metric;
  }, [type, xKey, yKey, metric, config.color]);

  
  const mapTooltip = ({ payload, label }) => {
    if (!payload || !payload.length) return null;
    const data = payload[0].payload;
    const items = payload.map((p, idx) => {
      const name = p.name || (stackKeys && stackKeys[idx]) || p.dataKey || `series ${idx+1}`;
      const val = (p.value != null && !isNaN(Number(p.value))) ? Number(p.value) : null;
      const isTimeOfDay = metric === 'bedtime_minutes' || metric === 'wake_minutes';
      const unit = (defaultMetricConfig(p.dataKey || metric, config.color)?.unit) || '';
      const display = isTimeOfDay && val != null
        ? minutesToHHmm(val)
        : (val != null ? `${val.toFixed(1)}${unit}` : 'N/A');
      const color = (p.color) || (p.stroke) || (p.fill) || '#64748b';
      return { label: name, value: display, color };
    });
    return { title: data?.formattedDate || label, items };
  };

  const CustomTooltip = (props) => <ChartTooltip {...props} mapPayload={mapTooltip} />;

  // Legacy tooltip removed to avoid unused variable warnings

  const formatXAxisTick = (tickItem) => {
    if (!tickItem && tickItem !== 0) return '';
    const dowNamesShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // jeśli to już dow, zwróć bez zmian
    if (typeof tickItem === 'string' && dowNamesShort.includes(tickItem)) return tickItem;
    // jeśli to już sformatowany napis (np. 'Sep 06'), zwróć go
    if (typeof tickItem === 'string' && /^[A-Za-z]{3}\s\d{1,2}$/.test(tickItem)) return tickItem;
    try {
      // spróbuj sparsować ISO lub string daty
      const parsed = typeof tickItem === 'string' ? parseISO(tickItem) : (tickItem instanceof Date ? tickItem : null);
      return parsed ? format(parsed, 'MMM dd') : String(tickItem);
    } catch {
      return String(tickItem);
    }
  };

  const formatYAxisTick = (value) => {
    if (metric === 'steps') {
      return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value;
    }
    if (metric === 'bedtime_minutes' || metric === 'wake_minutes') {
      return minutesToHHmm(value);
    }
    return value;
  };


  // Determine if we have data to render depending on chart type
  const hasData = useMemo(() => {
    if (type === 'scatter') {
      const x = xKey || 'x';
      const y = yKey || 'y';
      return Array.isArray(data) && data.some(d => d && d[x] != null && d[y] != null);
    }
    return chartData.length > 0;
  }, [type, data, xKey, yKey, chartData]);

  if (!hasData) {
    return (
      <div className="chart-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">No data available for {emptyLabel}</div>
      </div>
    );
  }

  const xDataKey = (chartData && chartData.length && chartData[0]?.dow) ? 'dow' : 'date';

  const renderChart = () => {
    const commonProps = {
      data: type === 'line' && rollingWindow ? lineWithRolling : chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (type) {
      case 'stacked-area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis dataKey={xDataKey} tickFormatter={xDataKey === 'date' ? formatXAxisTick : undefined} stroke="#64748b" fontSize={12} />
            <YAxis domain={yDomain || ['dataMin', 'dataMax']} ticks={yTicks} stroke="#64748b" fontSize={12} />
            {showTooltip && <ReTooltip content={<CustomTooltip />} />}
            {legend && <Legend />}
            {(stackKeys || []).map((k, idx) => (
              <Area key={k}
                type="monotone"
                dataKey={k}
                stackId="1"
                stroke={['#6366f1','#22c55e','#f59e0b','#ef4444'][idx % 4]}
                fill={['#6366f1','#22c55e','#f59e0b','#ef4444'][idx % 4]}
                fillOpacity={0.35}
              />
            ))}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis dataKey={xKey || 'x'} name={xKey || 'x'} stroke="#64748b" fontSize={12} />
            <YAxis dataKey={yKey || 'y'} name={yKey || 'y'} stroke="#64748b" fontSize={12} />
            {showTooltip && <ReTooltip /> }
            {/* Reference lines at medians for quick quadrant interpretation */}
            <ReferenceLine x={() => {
              const xs = data.map(d => d?.[xKey || 'x']).filter(v => v != null && !isNaN(v)).sort((a,b)=>a-b);
              const mid = Math.floor(xs.length/2);
              return xs.length ? (xs.length % 2 ? xs[mid] : (xs[mid-1]+xs[mid])/2) : null;
            }} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={() => {
              const ys = data.map(d => d?.[yKey || 'y']).filter(v => v != null && !isNaN(v)).sort((a,b)=>a-b);
              const mid = Math.floor(ys.length/2);
              return ys.length ? (ys.length % 2 ? ys[mid] : (ys[mid-1]+ys[mid])/2) : null;
            }} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Scatter data={data} fill={pointColor} name={`${xKey} vs ${yKey}`} />
          </ScatterChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis 
              dataKey={xDataKey} 
              tickFormatter={xDataKey === 'date' ? formatXAxisTick : undefined}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis 
              domain={config.domain}
              ticks={yTicks}
              tickFormatter={formatYAxisTick}
              stroke="#64748b"
              fontSize={12}
            />
            {showTooltip && <ReTooltip content={<CustomTooltip />} />}
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              fill={config.color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis 
              dataKey={xDataKey} 
              tickFormatter={xDataKey === 'date' ? formatXAxisTick : undefined}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis 
              domain={config.domain}
              ticks={yTicks}
              tickFormatter={formatYAxisTick}
              stroke="#64748b"
              fontSize={12}
            />
            {showTooltip && <ReTooltip content={<CustomTooltip />} />}
            <Bar
              dataKey="value"
              fill={config.color}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            <XAxis 
              dataKey={xDataKey} 
              tickFormatter={xDataKey === 'date' ? formatXAxisTick : undefined}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis 
              domain={config.domain}
              ticks={yTicks}
              tickFormatter={formatYAxisTick}
              stroke="#64748b"
              fontSize={12}
            />
            {showTooltip && <ReTooltip content={<CustomTooltip />} />}
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={3}
              dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: config.color, strokeWidth: 2 }}
            />
            {rollingWindow && (
              <Line
                type="monotone"
                dataKey="ra"
                stroke={raColor}
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className="health-chart">
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>

      <style jsx>{`
        .health-chart {
          width: 100%;
        }

        .chart-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: ${height}px;
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

        :global(.custom-tooltip) {
          /* glassmorphism */
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          
          
          
          
          
          
        }

        

        :global(.tooltip-label) {
          color: var(--text-primary);
          
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        :global(.dark .tooltip-label) {
          color: #f1f5f9;
        }

        :global(.tooltip-value) {
          margin: 0 0 4px 0;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        :global(.tooltip-metric) {
          color: var(--text-muted);
          
          color: #64748b;
        }

        :global(.dark .tooltip-metric) {
          color: #94a3b8;
        }

        :global(.tooltip-number) {
          color: var(--text-primary);
          
          font-weight: 600;
          color: ${config.color};
        }

        :global(.tooltip-extra) {
          margin: 4px 0 0 0;
          font-size: 0.875rem;
          color: #64748b;
        }

        :global(.dark .tooltip-extra) {
          color: #94a3b8;
        }

        @media (max-width: 768px) {
          .health-chart :global(.recharts-cartesian-axis-tick-value) {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default HealthChart;