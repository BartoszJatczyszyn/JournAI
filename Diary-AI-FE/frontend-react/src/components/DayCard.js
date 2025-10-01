import React from 'react';

/*
  DayCard: kolorowe tło zależne od composite/recovery/mood/energy.
  Strategia koloru:
    - jeśli jest recovery_score -> mapujemy 0..100 na gradient czerwony->zielony
    - fallback: średnia (mood, energy_level, sleep_quality_manual) \in 0..10 -> kolor
  Parametry:
    day: string
    journal: object (z polami)
    recoveryScore?: number
    children: content
*/

function lerp(a,b,t){ return a + (b-a)*t; }
function clamp(v,min=0,max=1){ return Math.min(max, Math.max(min, v)); }

function scoreToColor(score){
  // score 0..100 -> 0..1
  const t = clamp(score/100);
  // gradient: red (220,38,38) -> amber (245,158,11) -> green (16,185,129)
  let c1, c2, localT;
  if (t < 0.5){
    localT = t/0.5; // 0..1
    c1 = [220,38,38]; // red-600
    c2 = [245,158,11]; // amber-500
  } else {
    localT = (t-0.5)/0.5;
    c1 = [245,158,11];
    c2 = [16,185,129]; // emerald-500
  }
  const r = Math.round(lerp(c1[0], c2[0], localT));
  const g = Math.round(lerp(c1[1], c2[1], localT));
  const b = Math.round(lerp(c1[2], c2[2], localT));
  return `rgb(${r},${g},${b})`;
}

function simpleAvgColor(j){
  const vals = ['mood','energy_level','sleep_quality_manual'].map(k=> j?.[k]).filter(v=> v!=null);
  if (!vals.length) return '#334155';
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length; // 0..10
  return scoreToColor(avg/10*100);
}

export default function DayCard({ day, journal, recoveryScore, children }){
  const baseColor = recoveryScore != null ? scoreToColor(recoveryScore) : simpleAvgColor(journal);
  const gradient = `linear-gradient(135deg, ${baseColor}33 0%, ${baseColor}18 60%, #0f172a 100%)`;
  return (
    <div style={{
      background: gradient,
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 2px 4px -1px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{day}</div>
        {recoveryScore != null && <div style={{ fontSize:12, color:'#e2e8f0' }}>Recovery: <strong>{recoveryScore}</strong></div>}
      </div>
      {children}
    </div>
  );
}