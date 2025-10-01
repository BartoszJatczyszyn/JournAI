import React from 'react';

export default function TrendSparkline({ data, width=80, height=28, color='#38bdf8', strokeWidth=2, background='#1e293b' }) {
  if (!data || !data.length) return <div style={{ fontSize:10, color:'#475569' }}>—</div>;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = (i / (values.length - 1)) * (width - 6) + 3;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display:'block', background, borderRadius:4 }}>
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} points={pts} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v,i) => {
        const x = (i / (values.length - 1)) * (width - 6) + 3;
        const y = height - 4 - ((v - min) / range) * (height - 8);
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />;
      })}
    </svg>
  );
}