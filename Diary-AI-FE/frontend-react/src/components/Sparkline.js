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
  if (!data || data.length === 0) return <div className={className}>No data</div>;
  const values = data.map(d => typeof d === 'number' ? d : (d.value ?? d.dist ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // Responsive width: try to fill container, but ensure a sensible min spacing per point
  const containerWidth = containerRef.current?.clientWidth || 0;
  const minGap = 32; // minimum px per point to make chart readable
  const naturalWidth = Math.max(values.length * minGap, 120);
  const w = Math.max(naturalWidth, containerWidth || naturalWidth);
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

  // Update on container resize so SVG can fill available width
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      // trigger a re-render by updating tooltip state with same values
      setTooltip(t => ({ ...t }));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

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
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, background: 'rgba(17,24,39,0.95)', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 50 }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default Sparkline;
