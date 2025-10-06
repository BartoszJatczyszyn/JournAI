import React, { useRef, useState, useEffect } from 'react';

/**
 * Simple SVG sparkline.
 * props:
 *  data: array of numbers OR array of objects with { value }
 *  height: px height (default 40)
 *  stroke: line color
 *  fill: area fill (optional)
 *  strokeWidth
 *  className
 *  tooltipFormatter: function(pointValue, index)
 */
const Sparkline = ({ data, height = 40, stroke = '#6366f1', fill = 'rgba(99,102,241,0.15)', strokeWidth = 2, className = '', tooltipFormatter, tooltipTheme = 'glass', xLabel, yLabel }) => {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [containerWidth, setContainerWidth] = useState(null);

  // Update on container resize so SVG can fill available width
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
  }, [containerRef]);

  if (!data || data.length === 0) return <div className={className}>No data</div>;
  const values = data.map(d => typeof d === 'number' ? d : (d.value ?? d.dist ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // Responsive width: compute spacing so chart fits container width while keeping a sensible gap
  const minGap = 12; // allow tighter packing when container is narrow
  const maxGap = 96;
  const naturalWidth = Math.max(values.length * minGap, 120);
  const avail = containerWidth || 0;
  // compute base gap to fill available width; if no container width yet, fall back to minGap
  const baseGap = avail && values.length > 1 ? Math.max(1, (avail - 4) / (values.length - 1)) : minGap;
  const gap = Math.max(minGap, Math.min(maxGap, Math.floor(baseGap)));
  const w = avail && avail > 0 ? Math.max(120, (values.length - 1) * gap + 4) : naturalWidth;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    // Provide both v and value for backward compatibility with callers expecting point.value
    return { x, y, v, value: v };
  });
  const path = points.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${height-2} ` + points.map((p)=>`L${p.x},${p.y}`).join(' ') + ` L${points[points.length-1].x},${height-2} Z`;

  const computePos = (evt, content) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const cw = rect.width || containerRef.current?.clientWidth || 0;
    const ch = rect.height || containerRef.current?.clientHeight || 0;
    const estW = 170; // estimated tooltip width
    const estH = 90;  // estimated tooltip height
    let x = evt.clientX - rect.left + 12;
    let y = evt.clientY - rect.top + 12;
    if (x + estW > cw - 4) x = Math.max(4, cw - estW - 4);
    if (y + estH > ch - 4) y = Math.max(4, evt.clientY - rect.top - estH - 12);
    return { x, y, content };
  };
  const showTip = (evt, content) => {
    setTooltip({ visible: true, ...computePos(evt, content) });
  };
  const moveTip = (evt, content) => {
    setTooltip(t => ({ ...t, ...computePos(evt, content) }));
  };
  const hideTip = () => setTooltip({ visible: false, x: 0, y: 0, content: '' });


  const tooltipStyle = tooltipTheme === 'glass' ? {
    position: 'absolute',
    left: tooltip.x,
    top: tooltip.y,
    pointerEvents: 'none'
  } : {
    position: 'absolute', left: tooltip.x, top: tooltip.y, background: '#111827', color: '#f1f5f9', padding: '6px 8px', fontSize: 12, borderRadius: 6, pointerEvents: 'none'
  };

  return (
  <div ref={containerRef} className={className} style={{ overflow: 'visible', position: 'relative', paddingLeft: yLabel ? 18 : 0, paddingBottom: xLabel ? 18 : 0 }}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block">
        {yLabel && (
          <text x={0} y={height/2} textAnchor="middle" fontSize={10} fill="#64748b" transform={`rotate(-90 0 ${height/2})`}>{yLabel}</text>
        )}
        {fill && <path d={areaPath} fill={fill} stroke="none" />}
        <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p,i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={stroke}
              onMouseEnter={e => {
                if (!tooltipFormatter) return;
                // ensure we pass a normalized point object and guard the formatter
                const safePoint = p || { x: 0, y: 0, value: null, v: null };
                let content = '';
                try { content = tooltipFormatter(safePoint, i); } catch (err) { console.error('Sparkline tooltipFormatter error:', err); }
                showTip(e, content);
              }}
              onMouseMove={e => {
                if (!tooltipFormatter) return;
                const safePoint = p || { x: 0, y: 0, value: null, v: null };
                let content = '';
                try { content = tooltipFormatter(safePoint, i); } catch (err) { console.error('Sparkline tooltipFormatter error:', err); }
                moveTip(e, content);
              }}
              onMouseLeave={hideTip}
            />
          </g>
        ))}
      </svg>
      {xLabel && (
        <div style={{ position: 'absolute', left: yLabel ? 10 : 0, bottom: 2, width: '100%', textAlign: 'center', fontSize: 10, color: '#64748b', pointerEvents: 'none' }}>{xLabel}</div>
      )}
      {tooltip.visible && (
        <div style={tooltipStyle} className={tooltipTheme === 'glass' ? 'custom-tooltip' : 'glass-tooltip'}>
          {(() => {
            const c = tooltip.content;
            if (React.isValidElement(c)) return c;
            if (typeof c === 'object' && c) {
              return (
                <>
                  <p className="tooltip-label">{c.label || 'Point'}</p>
                  <p className="tooltip-value">
                    <span className="tooltip-metric" style={{ color: stroke }}>{c.type === 'pace' ? 'Pace:' : 'Value:'}</span>
                    <span className="tooltip-number">{c.value}</span>
                  </p>
                </>
              );
            }
            return (
              <>
                <p className="tooltip-label">Value</p>
                <p className="tooltip-value"><span className="tooltip-metric">Point:</span><span className="tooltip-number">{String(c)}</span></p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Sparkline;
