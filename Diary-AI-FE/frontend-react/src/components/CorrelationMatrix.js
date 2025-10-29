import React, { useMemo } from 'react';
import { lowerIsBetterNote } from '../utils/metricUtils';

const methodColors = {
  pearson: '#3b82f6',
  spearman: '#10b981',
  kendall: '#f59e0b',
  auto: '#6366f1'
};

const CorrelationMatrix = ({ data = [], maxItems = 10, minAbs = 0.3, selectedMethod }) => {
  const processedData = useMemo(() => {
    if (!data) return [];

    // If data is already an array treat it as list of {field1, field2, correlation}
    let list = Array.isArray(data) ? data : null;

    if (!list && typeof data === 'object') {
      // Accept shapes:
      // { significant_correlations: [...] }
      // { correlations: { significant_correlations: [...] }}
      // Or matrices: { correlations: { pearson: {...}, spearman: {...}, kendall: {...} } }
      const sig = data.significant_correlations
        || data?.correlations?.significant_correlations;
      if (Array.isArray(sig) && sig.length) {
        list = sig;
      } else {
        const root = data.correlations || data;
        if (root && typeof root === 'object') {
          const methods = ['pearson','spearman','kendall'];
          const rows = [];
            methods.forEach(m => {
              const matrix = root[m];
              if (matrix && typeof matrix === 'object') {
                Object.keys(matrix).forEach(a => {
                  const row = matrix[a];
                  if (row && typeof row === 'object') {
                    Object.keys(row).forEach(b => {
                      if (a === b) return;
                      const val = row[b];
                      if (val == null || Number.isNaN(val)) return;
                      rows.push({ field1: a, field2: b, correlation: val, method: m });
                    });
                  }
                });
              }
            });
          // Deduplicate pairs keeping strongest abs value
          const bestMap = new Map();
          rows.forEach(r => {
            const key = r.field1 < r.field2 ? `${r.field1}|${r.field2}` : `${r.field2}|${r.field1}`;
            const existing = bestMap.get(key);
            if (!existing || Math.abs(r.correlation) > Math.abs(existing.correlation)) {
              bestMap.set(key, r);
            }
          });
          list = Array.from(bestMap.values());
        }
      }
    }

    if (!Array.isArray(list)) return [];

    return list
      .filter(item => Math.abs(item.correlation || 0) >= minAbs)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, maxItems)
      .map(item => ({
        ...item,
        absCorrelation: Math.abs(item.correlation || 0),
        strength: getCorrelationStrength(item.correlation || 0),
        direction: (item.correlation || 0) >= 0 ? 'positive' : 'negative'
      }));
  }, [data, maxItems, minAbs]);

  function getCorrelationStrength(correlation) {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'strong';
    if (abs >= 0.5) return 'moderate';
    if (abs >= 0.3) return 'weak';
    return 'negligible';
  }

  function getCorrelationColor(correlation, strength) {
    if (strength === 'negligible') return '#6b7280';
    
    if (correlation >= 0) {
      // Positive correlations - green shades
      if (strength === 'strong') return '#059669';
      if (strength === 'moderate') return '#10b981';
      return '#34d399';
    } else {
      // Negative correlations - red shades
      if (strength === 'strong') return '#dc2626';
      if (strength === 'moderate') return '#ef4444';
      return '#f87171';
    }
  }

  function formatFieldName(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Rhr', 'RHR')
      .replace('Hr', 'HR');
  }

  function getCorrelationDescription(field1, field2, correlation, strength) {
    const direction = correlation >= 0 ? 'positively' : 'negatively';
    const strengthText = strength === 'strong' ? 'strongly' : 
                        strength === 'moderate' ? 'moderately' : 'weakly';
    const base = `${formatFieldName(field1)} is ${strengthText} ${direction} correlated with ${formatFieldName(field2)}`;
    // append note if either metric is lower-is-better
    const note = (lowerIsBetterNote(field1) || lowerIsBetterNote(field2)) || '';
    return base + note;
  }

  if (!processedData.length) {
    return (
      <div className="correlation-empty">
        <div className="empty-icon">🔗</div>
        <div className="empty-text">No significant correlations found</div>
        <div className="empty-subtitle">
          Correlations with strength ≥ 0.3 will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="correlation-matrix">
      <div className="correlation-legend">
        <div className="legend-item">
          <div className="legend-color positive"></div>
          <span>Positive correlation</span>
        </div>
        <div className="legend-item">
          <div className="legend-color negative"></div>
          <span>Negative correlation</span>
        </div>
        <div className="legend-strength">
          <span className="legend-label">Strength:</span>
          <span className="strength-indicator strong">Strong (≥0.7)</span>
          <span className="strength-indicator moderate">Moderate (≥0.5)</span>
          <span className="strength-indicator weak">Weak (≥0.3)</span>
        </div>
      </div>

      <div className="correlation-list">
        {processedData.map((item, index) => (
          <div key={index} className="correlation-item">
            <div className="correlation-header">
              <div className="correlation-fields">
                <span className="field-name">{formatFieldName(item.field1)}</span>
                <div className="correlation-arrow">
                  {item.direction === 'positive' ? '↗️' : '↘️'}
                </div>
                <span className="field-name">{formatFieldName(item.field2)}</span>
              </div>
              <div className="correlation-value-container">
                <div className="method-badge" style={{ background: methodColors[item.method] || methodColors[selectedMethod] || '#475569' }}>
                  {(item.method || selectedMethod || 'auto').slice(0,1).toUpperCase()}
                </div>
                <div 
                  className="correlation-value"
                  style={{ color: getCorrelationColor(item.correlation, item.strength) }}
                >
                  {item.correlation.toFixed(3)}
                </div>
                <div className={`strength-badge ${item.strength}`}>
                  {item.strength}
                </div>
              </div>
            </div>
            
            <div className="correlation-bar-container">
              <div className="correlation-bar">
                <div 
                  className="correlation-fill"
                  style={{
                    width: `${item.absCorrelation * 100}%`,
                    backgroundColor: getCorrelationColor(item.correlation, item.strength)
                  }}
                ></div>
              </div>
            </div>
            
            <div className="correlation-description">
              {getCorrelationDescription(item.field1, item.field2, item.correlation, item.strength)}
            </div>
          </div>
        ))}
      </div>

  <style>{`
        .correlation-matrix {
          width: 100%;
        }

        .correlation-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #64748b;
          text-align: center;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 1.125rem;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .empty-subtitle {
          font-size: 0.875rem;
          opacity: 0.7;
        }

        .correlation-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          align-items: center;
          margin-bottom: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .dark .correlation-legend {
          background: #334155;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .legend-color.positive {
          background: #10b981;
        }

        .legend-color.negative {
          background: #ef4444;
        }

        .legend-strength {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .legend-label {
          font-weight: 500;
          color: #374151;
        }

        .dark .legend-label {
          color: #d1d5db;
        }

        .strength-indicator {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .strength-indicator.strong {
          background: #dcfce7;
          color: #166534;
        }

        .strength-indicator.moderate {
          background: #fef3c7;
          color: #92400e;
        }

        .strength-indicator.weak {
          background: #fee2e2;
          color: #991b1b;
        }

        .dark .strength-indicator.strong {
          background: #14532d;
          color: #bbf7d0;
        }

        .dark .strength-indicator.moderate {
          background: #451a03;
          color: #fbbf24;
        }

        .dark .strength-indicator.weak {
          background: #7f1d1d;
          color: #fca5a5;
        }

        .correlation-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .correlation-item {
          padding: 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .correlation-item:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-color: #cbd5e1;
        }

        .dark .correlation-item {
          background: #1e293b;
          border-color: #334155;
        }

        .dark .correlation-item:hover {
          border-color: #475569;
        }

        .correlation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .correlation-fields {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .field-name {
          font-weight: 500;
          color: #1e293b;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .dark .field-name {
          color: #f1f5f9;
          background: #334155;
        }

        .correlation-arrow {
          font-size: 1.25rem;
        }

        .correlation-value-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .method-badge {
          padding: 4px 6px;
          border-radius: 6px;
          color: #fff;
          font-size: 0.625rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          line-height: 1;
        }

        .correlation-value {
          font-size: 1.125rem;
          font-weight: 700;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .strength-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .strength-badge.strong {
          background: #dcfce7;
          color: #166534;
        }

        .strength-badge.moderate {
          background: #fef3c7;
          color: #92400e;
        }

        .strength-badge.weak {
          background: #fee2e2;
          color: #991b1b;
        }

        .dark .strength-badge.strong {
          background: #14532d;
          color: #bbf7d0;
        }

        .dark .strength-badge.moderate {
          background: #451a03;
          color: #fbbf24;
        }

        .dark .strength-badge.weak {
          background: #7f1d1d;
          color: #fca5a5;
        }

        .correlation-bar-container {
          margin-bottom: 12px;
        }

        .correlation-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .dark .correlation-bar {
          background: #475569;
        }

        .correlation-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .correlation-description {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.5;
        }

        .dark .correlation-description {
          color: #94a3b8;
        }

        @media (max-width: 768px) {
          .correlation-legend {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .legend-strength {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .correlation-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .correlation-fields {
            flex-wrap: wrap;
          }

          .field-name {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};

export default CorrelationMatrix;