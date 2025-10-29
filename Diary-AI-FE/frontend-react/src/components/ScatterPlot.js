import React, { useMemo } from 'react';

// Simple responsive SVG scatter plot
// props: data [{ x: number, y: number }], width (auto), height, xLabel, yLabel, color
export default function ScatterPlot({ data, height = 140, color = '#10b981', xLabel = 'X', yLabel = 'Y' }) {
  const { points, w, h } = useMemo(() => {
    const h = height;
    const padL = 22, padB = 16, padT = 4, padR = 4;
    const w = Math.max(220, Math.min(800, (data?.length || 10) * 18));
    const xs = (data||[]).map(p => Number(p.x) || 0);
    const ys = (data||[]).map(p => Number(p.y) || 0);
    const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
    const rx = maxX - minX || 1;
    const ry = maxY - minY || 1;
    const points = (data||[]).map(({x,y}) => {
      const px = padL + ((Number(x)-minX)/rx) * (w - padL - padR);
      const py = h - padB - ((Number(y)-minY)/ry) * (h - padT - padB);
      return { px, py, x, y };
    });
    return { points, w, h };
  }, [data, height]);

  if (!data || data.length === 0) return <div className="text-xs text-gray-500">Brak danych</div>;

  const gridColor = '#e5e7eb';

  return (
    <div style={{ position: 'relative', overflow: 'auto' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
        {/* axes */}
        <line x1={22} y1={h-16} x2={w-4} y2={h-16} stroke={gridColor} strokeWidth={1} />
        <line x1={22} y1={4} x2={22} y2={h-16} stroke={gridColor} strokeWidth={1} />
        {/* points */}
        {points.map((p,i) => (
          <circle key={i} cx={p.px} cy={p.py} r={3.5} fill={color} opacity={0.8} />
        ))}
        {/* labels */}
        <text x={(w/2)} y={h-2} textAnchor="middle" fontSize={10} fill="#64748b">{xLabel}</text>
        <text x={10} y={h/2} textAnchor="middle" fontSize={10} fill="#64748b" transform={`rotate(-90 10 ${h/2})`}>{yLabel}</text>
      </svg>
    </div>
  );
}
