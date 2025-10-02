import React from 'react';

/* Volume1RMScatter
   Simple SVG scatter plot for volume vs est1RM.
   props: points = [{ volume, est1RM }], corr, width, height
*/
export default function Volume1RMScatter({ points, corr, width=220, height=140 }) {
  if (!points || points.length < 3) return <div className="text-[10px] text-gray-500">Insufficient data</div>;
  const pad = 20;
  const vols = points.map(p=>p.volume);
  const rms = points.map(p=>p.est1RM);
  const minV = Math.min(...vols), maxV = Math.max(...vols);
  const minR = Math.min(...rms), maxR = Math.max(...rms);
  const scaleX = v => pad + ( (v - minV) / (maxV - minV || 1) ) * (width - 2*pad);
  const scaleY = v => (height - pad) - ( (v - minR) / (maxR - minR || 1) ) * (height - 2*pad);
  return (
    <div className="space-y-1">
      <svg width={width} height={height} className="overflow-visible">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {points.map((p,i)=>(
          <circle key={i} cx={scaleX(p.volume)} cy={scaleY(p.est1RM)} r={4} fill="rgba(99,102,241,0.65)" />
        ))}
        {/* axes */}
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#999" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#999" strokeWidth={1} />
      </svg>
      <div className="text-[10px] text-gray-500">Corr: {corr!=null?corr.toFixed(2):'—'} (Volume vs est1RM)</div>
    </div>
  );
}
