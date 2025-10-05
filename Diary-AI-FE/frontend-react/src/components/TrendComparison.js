import React, { useRef, useState, useEffect } from 'react';
import { formatPaceMinPerKm } from '../utils/timeUtils';

/**
 * TrendComparison renders dual-series (distance vs rolling pace) over weeks.
 * Pace is inverted visually so that improvement (lower pace) trends upward.
 * props:
 *  data: [{ label, distance, rollingPace }] (rollingPace may be null)
 *  height: svg height
 *  distanceColor
 *  paceColor
 */
const TrendComparison = ({ data, forecast, height = 200, distanceColor = '#0ea5e9', paceColor = '#10b981', forecastColor = '#f59e0b' }) => {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const padding = 12;
  const [containerWidth, setContainerWidth] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || null;
      setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    // initialize
    setContainerWidth(containerRef.current.clientWidth || null);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length === 0) return <div>No trend data</div>;
  const distances = data.map(d => d.distance || 0);
  const paces = data.filter(d => d.rollingPace != null).map(d => d.rollingPace);
  const maxDist = Math.max(...distances, 1);
  const minDist = 0;
  const maxPace = paces.length ? Math.max(...paces) : 1;
  const minPace = paces.length ? Math.min(...paces) : 0;
  const paceRange = Math.max(maxPace - minPace, 0.0001);
  const distRange = Math.max(maxDist - minDist, 0.0001);
  // Determine a dynamic pointGap based on available container width so charts scale nicely.
  const minGap = 20; // allow tighter packing on narrow sections
  const maxGap = 96; // maximum px per point
  const provisionalGap = 56; // fallback gap
  const availWidth = (containerWidth && containerWidth > 0) ? (containerWidth - padding * 2) : null;
  const rawGap = availWidth && data.length > 1 ? Math.floor((availWidth) / Math.max(1, data.length - 1)) : provisionalGap;
  const pointGap = Math.max(minGap, Math.min(maxGap, rawGap));
  const computedWidth = (data.length - 1) * pointGap + padding * 2;
  // prefer to match container when available, but ensure computedWidth isn't smaller than needed
  const width = availWidth ? Math.max(availWidth + padding * 2, computedWidth) : computedWidth;
  const pointsDistance = data.map((d, i) => {
    const norm = (d.distance - minDist) / distRange;
    const x = padding + i * pointGap;
    const y = height - padding - norm * (height - padding * 2);
    return { x, y, value: d.distance, label: d.label };
  });
  const pointsPace = data.map((d, i) => {
    if (d.rollingPace == null) return null;
    // invert pace (lower is better -> higher on chart)
    const invNorm = (maxPace - d.rollingPace) / paceRange;
    const x = padding + i * pointGap;
    const y = height - padding - invNorm * (height - padding * 2);
    return { x, y, value: d.rollingPace, label: d.label };
  }).filter(Boolean);

  const pathFrom = (pts) => pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');

  // Forecast rendering
  let forecastElems = null;
  if (forecast && (forecast.distance != null || forecast.rollingPace != null)) {
    const x = padding + pointsDistance.length * pointGap;
    const distY = forecast.distance != null ? (height - padding - ((forecast.distance - minDist) / distRange) * (height - padding * 2)) : null;
    const paceY = forecast.rollingPace != null && paces.length ? (height - padding - ((maxPace - forecast.rollingPace) / paceRange) * (height - padding * 2)) : null;
    forecastElems = (
      <g>
        {distY != null && (
          <g>
            <circle cx={x} cy={distY} r={5} fill={forecastColor} />
          </g>
        )}
        {paceY != null && (
          <g>
            <rect x={x-4} y={paceY-4} width={8} height={8} fill={paceColor} stroke={forecastColor} strokeWidth={1} />
          </g>
        )}
      </g>
    );
  }

  const showTip = (evt, content) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    setTooltip({ visible: true, x: evt.clientX - rect.left + 8, y: evt.clientY - rect.top + 8, content });
  };
  const moveTip = (evt, content) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    setTooltip(t => ({ ...t, x: evt.clientX - rect.left + 8, y: evt.clientY - rect.top + 8, content }));
  };
  const hideTip = () => setTooltip({ visible: false, x: 0, y: 0, content: '' });

  return (
    <div ref={containerRef} className="w-full overflow-x-auto" style={{ position: 'relative' }}>
      <svg width={width + (forecastElems ? pointGap : 0)} height={height} className="block">
        {/* Grid lines */}
        {[0.25,0.5,0.75].map(fr => (
          <line key={fr} x1={0} x2={width} y1={height*fr} y2={height*fr} stroke="#e5e7eb" strokeDasharray="4 4" />
        ))}
        {/* Distance area */}
        <path d={pathFrom(pointsDistance) + ` L${pointsDistance[pointsDistance.length-1].x},${height-padding} L${pointsDistance[0].x},${height-padding} Z`} fill="rgba(14,165,233,0.12)" stroke="none" />
        <path d={pathFrom(pointsDistance)} stroke={distanceColor} strokeWidth={2} fill="none" />
        {pointsDistance.map((p,i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={distanceColor}
              onMouseEnter={e => showTip(e, `${p.label}\nDistance: ${p.value.toFixed(2)} km`)}
              onMouseMove={e => moveTip(e, `${p.label}\nDistance: ${p.value.toFixed(2)} km`)}
              onMouseLeave={hideTip}
            />
            <text x={p.x} y={height-2} fontSize={11} textAnchor="middle" fill="#64748b">{(p.label||'').split('-W')[1] || p.label}</text>
          </g>
        ))}
        {/* Pace line */}
        {pointsPace.length > 1 && (
          <>
            <path d={pathFrom(pointsPace)} stroke={paceColor} strokeWidth={2} fill="none" strokeDasharray="4 2" />
            {pointsPace.map((p,i) => (
              <g key={`p-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      fill={paceColor}
                      onMouseEnter={e => showTip(e, `${p.label}\nRolling Pace: ${formatPaceMinPerKm(p.value) || (p.value.toFixed(2)+' min/km')} (lower better)`)}
                      onMouseMove={e => moveTip(e, `${p.label}\nRolling Pace: ${formatPaceMinPerKm(p.value) || (p.value.toFixed(2)+' min/km')} (lower better)`)}
                      onMouseLeave={hideTip}
                    />
              </g>
            ))}
          </>
        )}
        {forecastElems}
        {/* Axes labels (simple) */}
        <text x={8} y={12} fontSize={10} fill="#0ea5e9">Distance</text>
        <text x={8} y={24} fontSize={10} fill={paceColor}>Rolling Pace (inv)</text>
      </svg>
      <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: distanceColor }} /> Distance</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: paceColor }} /> Rolling Pace (lower is better)</div>
        {forecastElems && <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: forecastColor }} /> Forecast</div>}
      </div>
      {tooltip.visible && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, background: 'rgba(17,24,39,0.95)', color: 'white', padding: '8px 10px', borderRadius: 6, fontSize: 13, pointerEvents: 'none', whiteSpace: 'pre' }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default TrendComparison;
