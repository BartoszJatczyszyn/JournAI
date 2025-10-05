import React, { useEffect, useRef, useState } from 'react';

/**
 * Minimal scatter plot using SVG. Expects points: [{ x, y, label }]
 * x/y are numbers. Automatically adds simple axes and tooltips via title attribute.
 */
const ScatterPlot = ({ points = [], xLabel = 'X', yLabel = 'Y', height = 220, responsive = true, minWidth = 320 }) => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const pad = 32;
  // Responsive width handling
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);
  useEffect(() => {
    if (!responsive) return;
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth;
      if (w && w !== containerWidth) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth || null);
    return () => ro.disconnect();
  }, [responsive, containerWidth]);

  const naturalWidth = Math.max(minWidth, points.length * 24); // previous spacing but a bit tighter
  const width = responsive && containerWidth ? containerWidth : Math.min(900, naturalWidth); // cap so it doesn't explode

  const normX = x => {
    if (maxX === minX) return pad + (width - pad * 2) / 2;
    return pad + ((x - minX) / (maxX - minX)) * (width - pad * 2);
  };
  const normY = y => {
    if (maxY === minY) return height / 2;
    return height - pad - ((y - minY) / (maxY - minY)) * (height - pad * 2);
  };

  // Build light grid (5 ticks each axis)
  const ticks = 5;
  const xTicks = Array.from({ length: ticks + 1 }, (_, i) => minX + (i / ticks) * (maxX - minX || 1));
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + (i / ticks) * (maxY - minY || 1));
  if (!points || !points.length) return <div style={{ padding: 12, color: '#64748b' }}>No points to display</div>;
  return (
    <div ref={containerRef} style={{ width: '100%', overflowX: responsive ? 'hidden' : 'auto' }}>
      <svg width={width} height={height} style={{ background: 'linear-gradient(180deg,#0f172a,#0f172a)', display: 'block', width: responsive ? '100%' : width }}>
        {/* grid lines */}
        {xTicks.map((tx,i)=> (
          <line key={'gx'+i} x1={normX(tx)} y1={pad} x2={normX(tx)} y2={height-pad} stroke="#1e293b" strokeWidth={1} />
        ))}
        {yTicks.map((ty,i)=> (
          <line key={'gy'+i} x1={pad} y1={normY(ty)} x2={width-pad} y2={normY(ty)} stroke="#1e293b" strokeWidth={1} />
        ))}
        {/* axes */}
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#334155" strokeWidth={1.5} />
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#334155" strokeWidth={1.5} />
        <text x={pad} y={pad-8} fontSize={11} fill="#94a3b8">{yLabel}</text>
        <text x={width-pad} y={height-6} fontSize={11} fill="#94a3b8" textAnchor="end">{xLabel}</text>
        {/* points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={normX(p.x)} cy={normY(p.y)} r={5} fill="#0ea5e9" stroke="#0369a1" style={{ transition:'transform .15s' }} />
            <title>{(p.label ? p.label + ' — ' : '') + `${xLabel}: ${Number(p.x).toFixed(2)}, ${yLabel}: ${Number(p.y).toFixed(2)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default ScatterPlot;
