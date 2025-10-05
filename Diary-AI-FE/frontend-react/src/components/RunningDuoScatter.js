import React from 'react';
import ScatterPlot from './ScatterPlot';

/**
 * Renders selectable duo scatter datasets from running_analysis.duo_scatter
 */
export default function RunningDuoScatter({ duo }) {
  const [key, setKey] = React.useState('distance_vs_pace');
  const options = Object.keys(duo||{});
  const points = (duo && duo[key]) ? duo[key].map(p=>({ x:p.x, y:p.y, label:p.label })) : [];
  const labels = {
    distance_vs_pace: { x:'Distance (km)', y:'Pace (min/km)' },
    distance_vs_hr: { x:'Distance (km)', y:'Avg HR' },
    cadence_vs_pace: { x:'Cadence', y:'Pace (min/km)' },
    step_length_vs_pace: { x:'Step Length (m)', y:'Pace (min/km)' },
    vertical_osc_vs_pace: { x:'Vertical Osc (cm?)', y:'Pace (min/km)' },
    ground_contact_vs_pace: { x:'Ground Contact (ms)', y:'Pace (min/km)' },
  };
  const meta = labels[key] || { x:'X', y:'Y' };
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between flex-wrap gap-2">
        <h3 className="card-title">Duo Scatter</h3>
        <select value={key} onChange={e=>setKey(e.target.value)} className="select select-sm">
          {options.map(o=> <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="card-content">
        {points.length > 1 ? (
          <ScatterPlot points={points} xLabel={meta.x} yLabel={meta.y} />
        ) : <div className="text-xs text-gray-500">Too few points to render the chart.</div>}
      </div>
    </div>
  );
}
