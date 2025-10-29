import React, { useMemo, useRef, useState, useEffect } from 'react';

/* Mini correlation heatmap for a single method matrix.
 * Props:
 *   matrix: { metricA: { metricB: value, ...}, ... }
 *   method: 'pearson' | 'spearman' | 'kendall'
 *   onSelectPair?: function(field1, field2)
 */
const CorrelationHeatmap = ({
  matrix,
  data,
  fields,
  method = 'pearson',
  onSelectPair,
  title,
  compact: compactProp = false,
  shrinkToContent = false,
  cellSize,
  showLegend = false,
  colorScheme = 'rg' // 'rg' | 'diverging'
}) => {
  // Build matrix if only raw data provided
  const derivedMatrix = useMemo(() => {
    if (matrix && typeof matrix === 'object') return matrix;
    if (!Array.isArray(data) || !Array.isArray(fields) || !fields.length) return null;
    const colValues = (field) => data.map(r => {
      const v = r == null ? null : (r[field] != null ? Number(r[field]) : null);
      return (v == null || Number.isNaN(v)) ? null : v;
    });
    const pearson = (a, b) => {
      const xs = []; const ys = [];
      for (let i = 0; i < a.length && i < b.length; i++) {
        const x = a[i]; const y = b[i];
        if (x == null || y == null) continue;
        xs.push(x); ys.push(y);
      }
      const n = xs.length; if (n < 2) return null;
      const mean = arr => arr.reduce((s,v)=>s+v,0)/arr.length;
      const mx = mean(xs); const my = mean(ys);
      let num = 0, sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i]-mx; const dy = ys[i]-my;
        num += dx*dy; sx += dx*dx; sy += dy*dy;
      }
      const denom = Math.sqrt(sx*sy); if (!denom) return null; return num/denom;
    };
    const mat = {}; const cols = fields.slice();
    for (const a of cols) {
      mat[a] = {}; const va = colValues(a);
      for (const b of cols) {
        const vb = colValues(b); const v = pearson(va, vb);
        mat[a][b] = v == null ? null : Number(v);
      }
    }
    return mat;
  }, [matrix, data, fields]);

  const effectiveMatrix = matrix && typeof matrix === 'object' ? matrix : derivedMatrix;

  const { metrics, cells } = useMemo(() => {
    if (!effectiveMatrix || typeof effectiveMatrix !== 'object') return { metrics: [], cells: [] };
    const metricSet = new Set(Object.keys(effectiveMatrix));
    Object.values(effectiveMatrix).forEach(row => { if (row && typeof row === 'object') Object.keys(row).forEach(k => metricSet.add(k)); });
    const metrics = Array.from(metricSet).sort();
    const cells = [];
    metrics.forEach((a,i) => {
      metrics.forEach((b,j) => {
        let v = null;
        if (effectiveMatrix[a] && typeof effectiveMatrix[a] === 'object' && typeof effectiveMatrix[a][b] === 'number') v = effectiveMatrix[a][b];
        else if (effectiveMatrix[b] && typeof effectiveMatrix[b] === 'object' && typeof effectiveMatrix[b][a] === 'number') v = effectiveMatrix[b][a];
        cells.push({ a,b,value:v,key:`${a}|${b}`,i,j });
      });
    });
    return { metrics, cells };
  }, [effectiveMatrix]);

  function colorFor(v) {
    if (v == null || Number.isNaN(v)) return 'transparent';
    const clamped = Math.max(-1, Math.min(1, v));
    if (colorScheme === 'diverging') {
      const t = (clamped + 1) / 2; // 0..1
      const hueStart = 215; const hueEnd = 2;
      const hue = hueStart + (hueEnd - hueStart) * t;
      const sat = 70; const abs = Math.abs(clamped); const light = 85 - abs * 43; // 85->42
      return `hsl(${hue.toFixed(1)}, ${sat}%, ${light.toFixed(1)}%)`;
    }
    const abs = Math.min(1, Math.abs(clamped));
    const intensity = Math.round(30 + abs * 70);
    if (clamped >= 0) return `hsl(155,65%,${100 - intensity/2}%)`;
    return `hsl(0,70%,${100 - intensity/2}%)`;
  }

  const autoCompact = metrics.length > 12;
  const compactMode = Boolean(compactProp || autoCompact);
  const sizeBase = compactMode ? 160 : 260;
  const minCell = compactMode ? 8 : 12;
  const size = Math.max(minCell, Math.min(40, sizeBase / Math.max(1, metrics.length)));

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContainerWidth(containerRef.current?.clientWidth || null));
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth || null);
    return () => ro.disconnect();
  }, []);

  // Layout calculations
  let firstColPct = compactMode ? 0.18 : 0.22;
  let firstColPx = containerWidth ? Math.max(80, Math.round(containerWidth * firstColPct)) : null;
  let availableForCells = containerWidth && firstColPx ? Math.max(0, containerWidth - firstColPx - 16) : null;
  let cellPx = availableForCells && metrics.length ? Math.max(6, Math.floor(availableForCells / metrics.length)) : size;
  let explicitTableWidth = null;
  if (shrinkToContent) {
    const baseCell = cellSize ? cellSize : (compactMode ? 40 : 52);
    firstColPx = compactMode ? 90 : 110;
    cellPx = baseCell;
    explicitTableWidth = firstColPx + metrics.length * baseCell + 16;
  }

  if (!metrics.length) return <div style={{ padding:16, fontSize:12, color:'#64748b' }}>No matrix data</div>;
  const hasAnyValue = cells.some(c => typeof c.value === 'number' && !Number.isNaN(c.value));
  if (!hasAnyValue) {
    return (
      <div className="corr-heatmap-empty" style={{ padding:12, fontSize:12, lineHeight:1.5 }}>
        <div style={{ fontWeight:600, marginBottom:4 }}>{title || 'Correlation Matrix'}</div>
        <div style={{ color:'#94a3b8' }}>No valid correlations available (insufficient overlapping numeric data between fields).</div>
      </div>
    );
  }

  const computedTitle = title === false ? null : (title || (method.charAt(0).toUpperCase()+method.slice(1)+' Matrix'));

  return (
    <div ref={containerRef} className={`corr-heatmap mini ${compactMode ? 'compact' : ''} ${shrinkToContent ? 'shrink' : ''}`} style={shrinkToContent ? { maxWidth: explicitTableWidth ? explicitTableWidth + 8 : undefined } : undefined}>
      {computedTitle && (
        <div className="heatmap-header">
          <div className="heatmap-title">{computedTitle}</div>
        </div>
      )}
      <div className="heatmap-scroll dark" style={shrinkToContent ? { overflowX: 'auto' } : undefined}>
        <table className="heatmap-table" style={{ '--cell-size': `${size}px`, '--cols': metrics.length, '--first-col': shrinkToContent ? `${firstColPx}px` : (compactMode ? '18%' : '22%'), width: shrinkToContent ? (explicitTableWidth ? `${explicitTableWidth}px` : 'auto') : (containerWidth ? `${containerWidth}px` : '100%') }}>
          <thead>
            <tr>
              <th></th>
              {metrics.map(m => (
                <th key={m} title={m} className="col-name" style={{ width: cellPx ? `${cellPx}px` : undefined }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(row => (
              <tr key={row}>
                <th title={row} className="row-name" style={{ minWidth: firstColPx ? `${firstColPx}px` : undefined, width: shrinkToContent && firstColPx ? `${firstColPx}px` : undefined }}>{row}</th>
                {metrics.map(col => {
                  const cell = cells.find(c => c.a === row && c.b === col);
                  const v = cell?.value;
                  return (
                    <td
                      key={col}
                      className="hm-cell"
                      title={v == null ? '—' : `${row} vs ${col}: ${v.toFixed(3)}`}
                      style={{ background: colorFor(v), cursor: v == null ? 'default' : 'pointer', width: cellPx ? `${cellPx}px` : undefined, maxWidth: cellPx ? `${cellPx}px` : undefined }}
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
      {showLegend && (
        <div className="heatmap-legend">
          <div className="legend-bar-wrapper">
            <div className={`legend-bar ${colorScheme}`}></div>
            <div className="legend-labels"><span>-1</span><span>0</span><span>+1</span></div>
          </div>
          <div className="legend-hint">Click a cell to highlight a pair</div>
        </div>
      )}
  <style>{`
        .corr-heatmap.mini { display:flex; flex-direction:column; gap:8px; }
        .heatmap-header { display:flex; justify-content:space-between; align-items:center; }
        .heatmap-title { font-size:0.9rem; font-weight:700; color:#f8fafc; }
        .heatmap-scroll { overflow:auto; overflow-x:hidden; border-radius:8px; background:#071022; border:1px solid #0b1220; padding:8px; margin-left:0px; max-height:420px; }
        .heatmap-scroll.dark { background: linear-gradient(180deg,#071028,#071022); border-color:#0b1220; }
        .heatmap-table { border-collapse:collapse; font-size:0.8rem; color:#f1f5f9; table-layout: fixed; width:100%; max-width:100%; box-sizing:border-box; }
        .heatmap-table th { position:sticky; top:0; background:rgba(7,16,34,0.85); backdrop-filter:blur(4px); padding:6px 8px; font-weight:700; z-index:2; color:#cbd5e1; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; }
        .heatmap-table th.col-name { padding-bottom:6px; }
        .heatmap-table td.hm-cell { width: calc((100% - var(--first-col)) / var(--cols)); min-width:12px; height:var(--cell-size); text-align:center; font-weight:600; color:#0f172a; border:1px solid rgba(255,255,255,0.04); overflow:hidden; text-overflow:ellipsis; transition: outline 0.15s ease, transform 0.15s ease; }
        .heatmap-table td.hm-cell:hover { outline:2px solid #38bdf8; outline-offset:-2px; transform:scale(1.04); z-index:5; position:relative; }
        .heatmap-table tr th:first-child { position:sticky; left:0; z-index:3; background:rgba(7,16,34,0.9); color:#e2e8f0; padding:6px 8px; min-width:var(--first-col); max-width:var(--first-col); overflow:hidden; text-overflow:ellipsis; }
        .row-name { text-align:left; padding-left:8px; white-space:nowrap; max-width:var(--first-col); overflow:hidden; text-overflow:ellipsis; }
        .corr-heatmap.compact .heatmap-scroll { padding:6px; }
        .corr-heatmap.compact .heatmap-table th { padding:4px 6px; font-size:0.7rem; }
        .corr-heatmap.compact .heatmap-table td.hm-cell { font-size:0.65rem; }
        .corr-heatmap.compact .heatmap-title { font-size:0.85rem; }
        .heatmap-legend { display:flex; flex-direction:column; gap:4px; font-size:10px; color:#94a3b8; padding:4px 4px 2px; }
        .legend-bar { height:10px; width:100%; border-radius:6px; background:linear-gradient(90deg,#991b1b,#475569,#0f766e); position:relative; overflow:hidden; }
        .legend-bar.diverging { background:linear-gradient(90deg,hsl(215,70%,42%), hsl(215,55%,70%), hsl(2,70%,55%)); }
        .legend-labels { display:flex; justify-content:space-between; font-size:9px; letter-spacing:0.5px; }
        .legend-hint { font-size:9px; opacity:0.7; }
      `}</style>
    </div>
  );
};

export default CorrelationHeatmap;
