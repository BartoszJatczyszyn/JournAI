import React from 'react';
import Tooltip from './Tooltip';

/** Training load panel for acute/chronic ratio, monotony and strain */
export default function RunningTrainingLoadPanel({ data }) {
  if (!data) return null;
  if (data.samples && !data.acute_distance_7d && !data.chronic_distance_28d) {
    return (
      <div className="card h-full">
        <div className="card-header"><h3 className="card-title">Training Load</h3></div>
        <div className="card-content text-xs text-gray-500">Insufficient distance data to compute training load ({data.samples} samples).</div>
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="card h-full">
        <div className="card-header"><h3 className="card-title">Training Load</h3></div>
        <div className="card-content text-xs text-gray-500">No training load data ({data.error}).</div>
      </div>
    );
  }
  const acr = data.acute_chronic_ratio;
  const monotony = data.monotony_index;
  const strain = data.training_strain;
  function colorizeACR(v){
    if (v == null) return 'text-gray-400';
    if (v < 0.7) return 'text-blue-400';
    if (v < 1.3) return 'text-green-400';
    if (v < 1.5) return 'text-amber-400';
    return 'text-red-400';
  }
  function colorizeMonotony(v){
    if (v == null) return 'text-gray-400';
    if (v < 1.0) return 'text-blue-400';
    if (v < 1.5) return 'text-green-400';
    if (v < 2.0) return 'text-amber-400';
    return 'text-red-400';
  }
  const rows = [
    { k:'Acute 7d', v:data.acute_distance_7d, fmt:v=>v!=null?v.toFixed(1)+' km':'—', tip:'Total distance last 7 days.'},
    { k:'Chronic 28d', v:data.chronic_distance_28d, fmt:v=>v!=null?v.toFixed(1)+' km':'—', tip:'Total distance last 28 days.'},
    { k:'AC Ratio', v:acr, fmt:v=>v!=null?v.toFixed(2):'—', tip:'Acute / Chronic distance load balance.', className:colorizeACR(acr)},
    { k:'Monotony', v:monotony, fmt:v=>v!=null?v.toFixed(2):'—', tip:'Mean / Std Dev of last 7 days distance.', className:colorizeMonotony(monotony)},
    { k:'Strain', v:strain, fmt:v=>v!=null?strain.toFixed(1):'—', tip:'Acute * Monotony (overall load strain).'},
  ];
  return (
    <div className="card h-full">
      <div className="card-header flex items-center justify-between">
  <h3 className="card-title">Training Load</h3>
  <span className="text-[10px] text-gray-500">ACR / Monotony</span>
      </div>
      <div className="card-content text-xs">
        <table className="w-full">
          <tbody>
          {rows.map(r=> (
            <tr key={r.k} className="border-b last:border-0 border-gray-700/40">
              <td className="py-1 pr-2 font-medium flex items-center gap-1">{r.k}{r.tip && <Tooltip content={r.tip} />}</td>
              <td className={"py-1 text-right tabular-nums "+(r.className||'')}>{r.fmt(r.v)}</td>
            </tr>
          ))}
          </tbody>
        </table>
        <div className="mt-3 text-[10px] leading-relaxed text-gray-500 space-y-1">
          <p>Optimal ACR 0.7–1.3. Above 1.5 = elevated overload risk.</p>
          <p>Monotony &gt; 2 indicates low variability – consider introducing variation.</p>
        </div>
      </div>
    </div>
  );
}
