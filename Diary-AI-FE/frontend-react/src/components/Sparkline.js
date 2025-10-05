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
const Sparkline = ({ data, height = 40, stroke = '#6366f1', fill = 'rgba(99,102,241,0.15)', strokeWidth = 2, className = '', tooltipFormatter }) => {
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

  const showTip = (evt, content) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    setTooltip({ visible: true, x: evt.clientX - rect.left + 8, y: evt.clientY - rect.top + 8, content });
  };
  const moveTip = (evt, content) => {
    const rect = containerRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    setTooltip(t => ({ ...t, x: evt.clientX - rect.left + 8, y: evt.clientY - rect.top + 8, content }));
  };
  const hideTip = () => setTooltip({ visible: false, x: 0, y: 0, content: '' });


  const tooltipStyle = {
    position: 'absolute',
    left: tooltip.x,
    top: tooltip.y,
    background: 'var(--glass-bg, rgba(17,24,39,0.95))',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.06))',
    boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
    color: 'var(--text-primary, #f1f5f9)',
    padding: '6px 8px',
    borderRadius: 6,
    fontSize: 12,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 50
  };

  return (
    <div ref={containerRef} className={className} style={{ overflow: 'hidden', position: 'relative' }}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block">
        {fill && <path d={areaPath} fill={fill} stroke="none" />}
        <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p,i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={stroke}
              onMouseEnter={e => tooltipFormatter && showTip(e, tooltipFormatter(p, i))}
              onMouseMove={e => tooltipFormatter && moveTip(e, tooltipFormatter(p, i))}
              onMouseLeave={hideTip}
            />
          </g>
        ))}
      </svg>
      {tooltip.visible && (
        <div style={tooltipStyle} className="glass-tooltip">
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default Sparkline;
