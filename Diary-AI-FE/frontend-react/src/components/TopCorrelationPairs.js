import React from 'react';

const TopCorrelationPairs = ({ pairs, limit=10, categories={}, activeCats }) => {
  if (!pairs || !pairs.length) return null;
  const filtered = !activeCats ? pairs : pairs.filter(p => activeCats[categories?.[p.a]] && activeCats[categories?.[p.b]]);
  const sorted = [...filtered].sort((a,b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, limit);
  return (
    <div style={{ fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>Top Correlations</div>
      <div style={{ display:'grid', gap:4 }}>
        {sorted.map(p => {
          const color = p.value >= 0 ? '#22c55e' : '#ef4444';
          return (
            <div key={`${p.a}-${p.b}`} style={{ display:'flex', justifyContent:'space-between', background:'#1e293b', padding:'4px 8px', borderRadius:6 }}>
              <span style={{ color:'#e2e8f0' }}>{p.a} – {p.b} <span style={{ color:'#64748b' }}>({p.n})</span></span>
              <span style={{ color }}>{p.value.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopCorrelationPairs;
