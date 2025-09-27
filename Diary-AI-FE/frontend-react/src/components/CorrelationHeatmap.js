import React, { useMemo } from 'react';

/* Mini correlation heatmap for a single method matrix.
 * Props:
 *   matrix: { metricA: { metricB: value, ...}, ... }
 *   method: 'pearson' | 'spearman' | 'kendall'
 *   onSelectPair?: function(field1, field2)
 */
const CorrelationHeatmap = ({ matrix, method = 'pearson', onSelectPair }) => {
  const { metrics, cells } = useMemo(() => {
    if (!matrix || typeof matrix !== 'object') return { metrics: [], cells: [] };
    const metricSet = new Set(Object.keys(matrix));
    Object.values(matrix).forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => metricSet.add(k));
      }
    });
    const metrics = Array.from(metricSet).sort();
    const cells = [];
    metrics.forEach((a, i) => {
      metrics.forEach((b, j) => {
        let v = null;
        if (matrix[a] && typeof matrix[a] === 'object' && typeof matrix[a][b] === 'number') {
          v = matrix[a][b];
        } else if (matrix[b] && typeof matrix[b] === 'object' && typeof matrix[b][a] === 'number') {
            // Symmetry fallback
            v = matrix[b][a];
        }
        cells.push({ a, b, value: v, key: `${a}|${b}`, i, j });
      });
    });
    return { metrics, cells };
  }, [matrix]);

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

  const size = Math.max(18, Math.min(40, 260 / metrics.length));

  return (
    <div className="corr-heatmap mini">
      <div className="heatmap-header">
        <div className="heatmap-title">{method.charAt(0).toUpperCase()+method.slice(1)} Matrix</div>
      </div>
      <div className="heatmap-scroll">
        <table className="heatmap-table" style={{ '--cell-size': `${size}px` }}>
          <thead>
            <tr>
              <th></th>
              {metrics.map(m => (
                <th key={m} title={m}>{shorten(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(row => (
              <tr key={row}>
                <th title={row}>{shorten(row)}</th>
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
        .corr-heatmap.mini { display:flex; flex-direction:column; gap:4px; }
        .heatmap-header { display:flex; justify-content:space-between; align-items:center; }
        .heatmap-title { font-size:0.7rem; font-weight:600; color:#1e293b; }
        :global(.dark) .heatmap-title { color:#f1f5f9; }
        .heatmap-scroll { overflow:auto; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; }
        :global(.dark) .heatmap-scroll { background:#1e293b; border-color:#334155; }
        .heatmap-table { border-collapse:collapse; font-size:0.55rem; }
        .heatmap-table th { position:sticky; top:0; background:#f8fafc; padding:2px 4px; font-weight:600; z-index:2; }
        :global(.dark) .heatmap-table th { background:#334155; color:#f1f5f9; }
        .heatmap-table td.hm-cell { width:var(--cell-size); height:var(--cell-size); text-align:center; font-weight:600; color:#0f172a; }
        :global(.dark) .heatmap-table td.hm-cell { color:#f1f5f9; }
        .heatmap-table tr th:first-child { position:sticky; left:0; z-index:3; background:#f8fafc; }
        :global(.dark) .heatmap-table tr th:first-child { background:#334155; }
      `}</style>
    </div>
  );
};

function shorten(name) {
  if (name.length <= 6) return name;
  return name.split('_').map(p => p[0]).join('').slice(0,6);
}

export default CorrelationHeatmap;
