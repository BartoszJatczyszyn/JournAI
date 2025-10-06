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
const TrendComparison = ({ data, forecast, height = 240, distanceColor = '#0ea5e9', paceColor = '#10b981', forecastColor = '#f59e0b' }) => {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, payload: null });
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
  const paceRange = Math.max(maxPace - minPace, 0.01);
  const distRange = Math.max(maxDist - minDist, 0.5);
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
    const distVal = (d.distance != null && !isNaN(Number(d.distance))) ? Number(d.distance) : 0;
    const norm = (distVal - minDist) / distRange;
    const x = padding + i * pointGap;
    const y = height - padding - norm * (height - padding * 2);
    return { x, y, value: distVal, label: d.label, idx: i };
  });
  const pointsPace = data.map((d, i) => {
    if (d.rollingPace == null) return null;
    // invert pace (lower is better -> higher on chart)
    const invNorm = (maxPace - d.rollingPace) / paceRange;
    const x = padding + i * pointGap;
    const y = height - padding - invNorm * (height - padding * 2);
    return { x, y, value: d.rollingPace, label: d.label, idx: i };
  }).filter(Boolean);

  const pathFrom = (pts) => pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');

  // compute linear regression trend for distance (index -> distance) and pace (index -> rollingPace)
  const computeTrendPoints = (vals, pts) => {
    const ptsWithVal = pts.map((p,i) => ({ i, v: vals[i] } )).filter(p=>p.v != null && Number.isFinite(p.v));
    if (ptsWithVal.length < 2) return null;
    const n = ptsWithVal.length;
    const meanI = ptsWithVal.reduce((s,p)=>s+p.i,0)/n;
    const meanV = ptsWithVal.reduce((s,p)=>s+p.v,0)/n;
    let num=0, den=0; ptsWithVal.forEach(p=>{ const dx = p.i-meanI; num += dx*(p.v-meanV); den += dx*dx; });
    const slope = den===0?0:num/den; const intercept = meanV - slope*meanI;
    const res = pts.map((p, _idx) => {
      const val = intercept + slope * _idx;
      return { x: p.x, y: p.y, value: val };
    });
    // convert value to y coordinate based on original scaling used above
    // For distance: y = height - padding - norm*(height - padding*2), norm = (val - minDist)/distRange
    if (vals === distances) {
      return res.map((r, _idx) => ({ x: r.x, y: height - padding - ((r.value - minDist) / distRange) * (height - padding * 2) }));
    }
    // For pace: invert scale: invNorm = (maxPace - val)/paceRange
    return res.map(r => ({ x: r.x, y: height - padding - ((maxPace - r.value) / paceRange) * (height - padding * 2) }));
  };

  const trendDistPts = computeTrendPoints(distances, pointsDistance);
  const trendPacePts = computeTrendPoints(paces, pointsPace);

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

  const computePos = (evt, payload) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left:0, top:0, width:0, height:0 };
    const cw = rect.width || containerRef.current?.clientWidth || 0;
    const ch = rect.height || containerRef.current?.clientHeight || 0;
    const estW = 170;
    const estH = 100;
    let x = evt.clientX - rect.left + 12;
    let y = evt.clientY - rect.top + 12;
    if (x + estW > cw - 4) x = Math.max(4, cw - estW - 4);
    if (y + estH > ch - 4) y = Math.max(4, evt.clientY - rect.top - estH - 12);
    return { x, y, payload };
  };
  const showTip = (evt, payload) => setTooltip({ visible: true, ...computePos(evt, payload) });
  const moveTip = (evt, payload) => setTooltip(t => ({ ...t, ...computePos(evt, payload) }));
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
        {/* Distance trend line (linear fit) */}
        {trendDistPts && (
          <path d={pathFrom(trendDistPts)} stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="6 4" opacity={0.95} />
        )}
        {pointsDistance.map((p,i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={distanceColor}
              onMouseEnter={e => {
                const pacePoint = pointsPace.find(pp => pp.idx === p.idx);
                showTip(e, { label: p.label, distance: p.value, pace: pacePoint?.value ?? null });
              }}
              onMouseMove={e => {
                const pacePoint = pointsPace.find(pp => pp.idx === p.idx);
                moveTip(e, { label: p.label, distance: p.value, pace: pacePoint?.value ?? null });
              }}
              onMouseLeave={hideTip}
            />
            <text x={p.x} y={height-2} fontSize={11} textAnchor="middle" fill="#64748b">{(p.label||'').split('-W')[1] || p.label}</text>
          </g>
        ))}
        {/* Pace line */}
        {pointsPace.length > 1 && (
          <>
            <path d={pathFrom(pointsPace)} stroke={paceColor} strokeWidth={2} fill="none" strokeDasharray="4 2" />
            {/* Pace trend line (linear fit) */}
            {trendPacePts && (
              <path d={pathFrom(trendPacePts)} stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="6 4" opacity={0.95} />
            )}
            {pointsPace.map((p,i) => (
              <g key={`p-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={paceColor}
                  onMouseEnter={e => {
                    const distPoint = pointsDistance.find(dd => dd.idx === p.idx);
                    showTip(e, { label: p.label, distance: distPoint?.value ?? null, pace: p.value });
                  }}
                  onMouseMove={e => {
                    const distPoint = pointsDistance.find(dd => dd.idx === p.idx);
                    moveTip(e, { label: p.label, distance: distPoint?.value ?? null, pace: p.value });
                  }}
                  onMouseLeave={hideTip}
                />
              </g>
            ))}
          </>
        )}
        {forecastElems}
    {/* Axes labels (simple) */}
    <text x={8} y={12} fontSize={10} fill={distanceColor}>Distance (km)</text>
    <text x={8} y={24} fontSize={10} fill={paceColor}>Rolling Pace (min/km, inverted)</text>
    {/* X axis label centered at bottom */}
    <text x={width/2} y={height-2} fontSize={11} fill="#64748b" textAnchor="middle">Week</text>
    {/* Y axis labels at rotated positions (left side for clarity) */}
    <text x={-height/2} y={10} transform={`rotate(-90 -${height/2} 10)`} fontSize={11} fill="#64748b" textAnchor="middle" style={{ display: 'none' }}>Value</text>
      </svg>
      <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: distanceColor }} /> Distance</div>
  <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: paceColor }} /> Rolling Pace (lower is better)</div>
        {forecastElems && <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-sm" style={{ background: forecastColor }} /> Forecast</div>}
      </div>
      {tooltip.visible && tooltip.payload && (
        <div className="custom-tooltip refined-tooltip" style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, pointerEvents: 'none' }}>
          <p className="tooltip-label refined-tooltip-title">{tooltip.payload.label}</p>
          {tooltip.payload.distance != null && (
            <div className="tooltip-value refined-tooltip-row">
              <span className="tooltip-metric refined-tooltip-metric" style={{ color: distanceColor }}>Distance</span>
              <span className="tooltip-number refined-tooltip-value">{tooltip.payload.distance.toFixed(2)} km</span>
            </div>
          )}
          {tooltip.payload.pace != null && (
            <div className="tooltip-value refined-tooltip-row">
              <span className="tooltip-metric refined-tooltip-metric" style={{ color: paceColor }}>Rolling Pace</span>
              <span className="tooltip-number refined-tooltip-value">{formatPaceMinPerKm(tooltip.payload.pace) || tooltip.payload.pace.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
      <style jsx>{`
        :global(.custom-tooltip) {
          background: var(--glass-bg, rgba(15,23,42,0.95));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
          box-shadow: var(--glass-shadow, 0 8px 24px rgba(0,0,0,0.35));
          padding: 10px 12px;
          border-radius: 10px;
          min-width: 140px;
          color: #0f172a;
        }
        :global(.dark .custom-tooltip) { color: #f1f5f9; }
        :global(.custom-tooltip .tooltip-label) { margin: 0 0 8px 0; font-weight: 600; font-size: 0.75rem; }
        :global(.custom-tooltip .tooltip-value) { margin: 0 0 4px 0; display: flex; justify-content: space-between; gap: 12px; font-size: 0.70rem; }
        :global(.custom-tooltip .tooltip-metric) { color: #64748b; }
        :global(.dark .custom-tooltip .tooltip-metric) { color: #94a3b8; }
        :global(.custom-tooltip .tooltip-number) { font-weight: 600; color: #0ea5e9; }
      `}</style>
    </div>
  );
};

export default TrendComparison;
