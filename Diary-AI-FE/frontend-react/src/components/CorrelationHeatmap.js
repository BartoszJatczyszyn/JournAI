import React, { useMemo } from 'react';

/* Mini correlation heatmap for a single method matrix.
 * Props:
 *   matrix: { metricA: { metricB: value, ...}, ... }
 *   method: 'pearson' | 'spearman' | 'kendall'
 *   onSelectPair?: function(field1, field2)
 */
const CorrelationHeatmap = ({ matrix, data, fields, method = 'pearson', onSelectPair, title }) => {
  // If matrix not provided, but data+fields are, compute pairwise Pearson correlations.
  const derivedMatrix = useMemo(() => {
    if (matrix && typeof matrix === 'object') return matrix;
    if (!Array.isArray(data) || !Array.isArray(fields) || fields.length === 0) return null;

    // helper: get numeric values for a field
    const colValues = (field) => data.map(r => {
      const v = r == null ? null : (r[field] != null ? Number(r[field]) : null);
      return (v == null || Number.isNaN(v)) ? null : v;
    });

    // compute Pearson correlation between two arrays (ignores pairs where either is null)
    const pearson = (a, b) => {
      const xs = [];
      const ys = [];
      for (let i = 0; i < a.length && i < b.length; i++) {
        const x = a[i];
        const y = b[i];
        if (x == null || y == null) continue;
        xs.push(x); ys.push(y);
      }
      const n = xs.length;
      if (n < 2) return null;
      const mean = arr => arr.reduce((s,v) => s+v, 0)/arr.length;
      const mx = mean(xs); const my = mean(ys);
      let num = 0; let sx = 0; let sy = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx; const dy = ys[i] - my;
        num += dx * dy; sx += dx*dx; sy += dy*dy;
      }
      const denom = Math.sqrt(sx * sy);
      if (denom === 0) return null;
      return num / denom;
    };

    const mat = {};
    const cols = fields.slice();
    for (const a of cols) {
      mat[a] = {};
      const va = colValues(a);
      for (const b of cols) {
        const vb = colValues(b);
        const v = pearson(va, vb);
        mat[a][b] = (v == null ? null : Number(v));
      }
    }
    return mat;
  }, [matrix, data, fields]);

  const effectiveMatrix = matrix && typeof matrix === 'object' ? matrix : derivedMatrix;

  const { metrics, cells } = useMemo(() => {
    if (!effectiveMatrix || typeof effectiveMatrix !== 'object') return { metrics: [], cells: [] };
    const metricSet = new Set(Object.keys(effectiveMatrix));
    Object.values(effectiveMatrix).forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => metricSet.add(k));
      }
    });
    const metrics = Array.from(metricSet).sort();
    const cells = [];
    metrics.forEach((a, i) => {
      metrics.forEach((b, j) => {
        let v = null;
        if (effectiveMatrix[a] && typeof effectiveMatrix[a] === 'object' && typeof effectiveMatrix[a][b] === 'number') {
          v = effectiveMatrix[a][b];
        } else if (effectiveMatrix[b] && typeof effectiveMatrix[b] === 'object' && typeof effectiveMatrix[b][a] === 'number') {
            // Symmetry fallback
            v = effectiveMatrix[b][a];
        }
        cells.push({ a, b, value: v, key: `${a}|${b}`, i, j });
      });
    });
    return { metrics, cells };
  }, [effectiveMatrix]);

  if (!metrics.length) {
    return <div style={{ padding: 16, fontSize: 12, color: '#64748b' }}>No matrix data</div>;
  }

  function colorFor(v) {
    if (v == null || Number.isNaN(v)) return 'transparent';
    const abs = Math.min(1, Math.abs(v));
    const intensity = Math.round(30 + abs * 70); // 30..100
    if (v >= 0) {
      return `hsl(155, 65%, ${100 - intensity/2}%)`; // greenish
    }
    return `hsl(0, 70%, ${100 - intensity/2}%)`; // reddish
  }

  // Restore more spacious sizing so labels and cells are easier to read
  const size = Math.max(18, Math.min(40, 260 / Math.max(1, metrics.length)));

  // (expand feature removed)

  return (
    <div className="corr-heatmap mini">
      <div className="heatmap-header">
        <div className="heatmap-title">{title || (method.charAt(0).toUpperCase()+method.slice(1)+' Matrix')}</div>
        {/* Expand button removed */}
      </div>
      <div className="heatmap-scroll dark">
        <table className="heatmap-table" style={{ '--cell-size': `${size}px` }}>
          <thead>
            <tr>
              <th></th>
              {metrics.map(m => (
                <th key={m} title={m} className="col-name">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(row => (
              <tr key={row}>
                <th title={row} className="row-name">{row}</th>
                {metrics.map(col => {
                  const cell = cells.find(c => c.a === row && c.b === col);
                  const v = cell?.value;
                  return (
                    <td
                      key={col}
                      className="hm-cell"
                      title={v == null ? '—' : `${row} vs ${col}: ${v.toFixed(3)}`}
                      style={{ background: colorFor(v), cursor: v == null ? 'default' : 'pointer' }}
                      onClick={() => v != null && onSelectPair && onSelectPair(row, col)}
                    >
                      {v == null ? '' : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
  .corr-heatmap.mini { display:flex; flex-direction:column; gap:8px; }
  .heatmap-header { display:flex; justify-content:space-between; align-items:center; }
  .heatmap-title { font-size:0.9rem; font-weight:700; color:#f8fafc; }
  .heatmap-scroll { overflow:auto; border-radius:8px; background:#071022; border:1px solid #0b1220; padding:8px; margin-left:0px; max-height:420px; }
        .heatmap-scroll.dark { background: linear-gradient(180deg,#071028,#071022); border-color:#0b1220; }
  .heatmap-table { border-collapse:collapse; font-size:0.8rem; color:#f1f5f9; }
  .heatmap-table th { position:sticky; top:0; background:transparent; padding:6px 8px; font-weight:700; z-index:2; color:#cbd5e1; white-space:normal; max-width:140px; word-break:break-word; }
        .heatmap-table th.col-name { transform:none; padding-bottom:6px; }
        .heatmap-table td.hm-cell { width:var(--cell-size); height:var(--cell-size); text-align:center; font-weight:700; color:#ffffff; border:1px solid rgba(255,255,255,0.03); }
        .heatmap-table tr th:first-child { position:sticky; left:0; z-index:3; background:transparent; color:#e2e8f0; padding:6px 8px; min-width:160px; }
        .row-name { text-align:left; padding-left:8px; white-space:normal; max-width:160px; word-break:break-word; }
      `}</style>
    </div>
  );
};

export default CorrelationHeatmap;
