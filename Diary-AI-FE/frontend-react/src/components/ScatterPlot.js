import React, { useEffect, useRef, useState } from 'react';
import { formatPaceMinPerKm } from '../utils/timeUtils';

/**
 * Minimal scatter plot using SVG. Expects points: [{ x, y, label }]
 * x/y are numbers. Automatically adds simple axes and tooltips via title attribute.
 */
const ScatterPlot = ({ points = [], xLabel = 'X', yLabel = 'Y', height = 260, responsive = true, minWidth = 320, tooltip = true, tooltipFormatter }) => {
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
    const denomX = (maxX === minX) ? (Math.abs(maxX) * 0.02 || 1) : (maxX - minX);
    return pad + ((x - minX) / denomX) * (width - pad * 2);
  };
  const normY = y => {
    const denomY = (maxY === minY) ? (Math.abs(maxY) * 0.02 || 1) : (maxY - minY);
    return height - pad - ((y - minY) / denomY) * (height - pad * 2);
  };

  // compute simple least-squares fit for the scatter (y = m*x + b)
  const fitLine = (() => {
    if (!points || points.length < 2) return null;
    const pts = points.filter(p => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y));
    if (pts.length < 2) return null;
    const n = pts.length;
    const meanX = pts.reduce((s,p)=>s+p.x,0)/n;
    const meanY = pts.reduce((s,p)=>s+p.y,0)/n;
    let num = 0, den = 0;
    pts.forEach(p => { const dx = p.x - meanX; num += dx * (p.y - meanY); den += dx * dx; });
    const m = den === 0 ? 0 : num / den;
    const b = meanY - m * meanX;
    const x0 = minX; const x1 = maxX;
    const y0 = m * x0 + b; const y1 = m * x1 + b;
    return { x0, y0, x1, y1 };
  })();

  // Build light grid (5 ticks each axis)
  const ticks = 5;
  const xTicks = Array.from({ length: ticks + 1 }, (_, i) => minX + (i / ticks) * (maxX - minX || 1));
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + (i / ticks) * (maxY - minY || 1));
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, payload: null });

  const showTip = (evt, payload) => {
    if (!tooltip) return;
    const rect = containerRef.current?.getBoundingClientRect?.() || { left:0, top:0, width:0, height:0 };
    const estW = 180; const estH = 110;
    let x = evt.clientX - rect.left + 12;
    let y = evt.clientY - rect.top + 12;
    if (x + estW > rect.width - 4) x = Math.max(4, rect.width - estW - 4);
    if (y + estH > rect.height - 4) y = Math.max(4, evt.clientY - rect.top - estH - 12);
    setTooltipState({ visible: true, x, y, payload });
  };
  const moveTip = (evt, payload) => showTip(evt, payload);
  const hideTip = () => setTooltipState(t => ({ ...t, visible: false }));

  const defaultFormatter = (p) => {
    if (!p) return null;
    const paceFormat = (label, val) => {
      if (label.toLowerCase().includes('pace') && val != null && !isNaN(val)) return formatPaceMinPerKm(val);
      return (val != null && !isNaN(val)) ? Number(val).toFixed(2) : '—';
    };
    return {
      title: p.label || 'Point',
      rows: [
        { k: xLabel, v: paceFormat(xLabel, p.x) },
        { k: yLabel, v: paceFormat(yLabel, p.y) }
      ]
    };
  };

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
        {/* best-fit trend line */}
        {fitLine && (
          <line x1={normX(fitLine.x0)} y1={normY(fitLine.y0)} x2={normX(fitLine.x1)} y2={normY(fitLine.y1)} stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" opacity={0.9} />
        )}
        {points.map((p, i) => {
          const ptPayload = { ...p };
          return (
            <g key={i}>
              <circle
                cx={normX(p.x)}
                cy={normY(p.y)}
                r={5}
                fill="#0ea5e9"
                stroke="#0369a1"
                style={{ transition:'transform .15s', cursor: tooltip ? 'pointer' : 'default' }}
                onMouseEnter={e => {
                  if (!tooltip) return;
                  const fmtd = (tooltipFormatter || defaultFormatter)(ptPayload) || null;
                  showTip(e, fmtd);
                }}
                onMouseMove={e => {
                  if (!tooltip) return;
                  const fmtd = (tooltipFormatter || defaultFormatter)(ptPayload) || null;
                  moveTip(e, fmtd);
                }}
                onMouseLeave={hideTip}
              />
            </g>
          );
        })}
      </svg>
      {tooltip && tooltipState.visible && tooltipState.payload && (
        <div className="custom-tooltip" style={{ position: 'absolute', left: tooltipState.x, top: tooltipState.y, pointerEvents: 'none' }}>
          <p className="tooltip-label">{tooltipState.payload.title}</p>
          {tooltipState.payload.rows && tooltipState.payload.rows.map(r => (
            <p key={r.k} className="tooltip-value">
              <span className="tooltip-metric">{r.k}:</span>
              <span className="tooltip-number" style={{ color: '#0ea5e9' }}>{r.v}</span>
            </p>
          ))}
        </div>
      )}
      <style jsx>{`
        :global(.custom-tooltip) {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(12px) saturate(1.15);
          -webkit-backdrop-filter: blur(12px) saturate(1.15);
          border: 1px solid rgba(148,163,184,0.3);
          box-shadow: 0 4px 16px -4px rgba(15,23,42,0.25), 0 2px 6px -2px rgba(15,23,42,0.15);
          border-radius: 10px;
          padding: 10px 12px 8px;
          min-width: 150px;
          animation: tooltipFade 120ms ease-out;
        }
        :global(.dark .custom-tooltip) {
          background: rgba(30,41,59,0.78);
          border-color: rgba(71,85,105,0.55);
        }
        @keyframes tooltipFade { from { opacity:0; transform: translateY(4px);} to { opacity:1; transform: translateY(0);} }
      `}</style>
    </div>
  );
};

export default ScatterPlot;
