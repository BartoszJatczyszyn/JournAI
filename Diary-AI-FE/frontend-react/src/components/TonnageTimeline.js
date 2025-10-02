import React from 'react';
import Sparkline from './Sparkline';

/* TonnageTimeline
   props: data = [{ date: 'YYYY-MM-DD', bodyPart: 'chest', volume: number }]
   Renders stacked-ish mini charts per body part + aggregate line.
*/
export default function TonnageTimeline({ data }) {
  if (!data || data.length === 0) return <div className="text-xs text-gray-500">No tonnage data</div>;
  // Group by date and bodyPart
  const byDate = new Map();
  data.forEach(d => {
    if (!byDate.has(d.date)) byDate.set(d.date, {});
    const slot = byDate.get(d.date);
    slot[d.bodyPart] = (slot[d.bodyPart] || 0) + d.volume;
  });
  const allParts = Array.from(new Set(data.map(d => d.bodyPart)));
  const timeline = Array.from(byDate.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
  const aggregateSeries = timeline.map(([day, parts]) => ({ value: Object.values(parts).reduce((a,b)=>a+b,0), day }));
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Total Tonnage</div>
        <Sparkline
          data={aggregateSeries.map(p=>({ value: p.value }))}
          height={50}
          stroke="#6366f1"
          fill="rgba(99,102,241,0.15)"
          tooltipFormatter={(pt,i)=>`${timeline[i][0]}: ${pt.value.toFixed(0)} kg`}
        />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {allParts.map(bp => {
          const partSeries = timeline.map(([day, parts]) => ({ value: parts[bp] || 0, day }));
          const sum = partSeries.reduce((a,b)=>a+b.value,0);
          return (
            <div key={bp} className="p-2 rounded border bg-white/40 dark:bg-gray-800/40">
              <div className="flex justify-between items-center mb-1">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{bp}</div>
                <div className="text-[10px] text-gray-400">Σ {sum.toFixed(0)}</div>
              </div>
              <Sparkline
                data={partSeries.map(p=>({ value: p.value }))}
                height={40}
                stroke="#10b981"
                fill="rgba(16,185,129,0.15)"
                tooltipFormatter={(pt,i)=>`${partSeries[i].day}: ${pt.value.toFixed(0)} kg`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
