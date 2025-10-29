import React from 'react';
import CorrelationMatrix from '../CorrelationMatrix';
import { Button } from 'shared/ui';

const CorrelationSection = ({ correlationsCount, showFullMatrix, onToggleFull, topCorrelations, preparedCorrelations }) => {
  if (!correlationsCount || correlationsCount <= 0) return null;
  return (
    <div className="correlation-section">
      <div className="card">
        <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h3 className="card-title">Health Correlations</h3>
            <p className="card-subtitle">Top relationships in the selected window ({correlationsCount})</p>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <Button size="sm" variant="ghost" onClick={onToggleFull}>{showFullMatrix ? 'Show compact' : 'Show full matrix'}</Button>
          </div>
        </div>
        <div style={{padding: 12}}>
          {!showFullMatrix ? (
            <ul style={{margin: 0, paddingLeft: 16}}>
              {topCorrelations.map((c, i) => (
                <li key={i} style={{marginBottom: 6}}>
                  <strong>{c.field1}</strong> ↔ <strong>{c.field2}</strong>: r = {c.correlation.toFixed(2)} (n={c.n})
                </li>
              ))}
              {preparedCorrelations.length > topCorrelations.length && (
                <li style={{marginTop: 8, color: '#475569'}}>And {preparedCorrelations.length - topCorrelations.length} more — switch to full matrix to explore.</li>
              )}
            </ul>
          ) : (
            <CorrelationMatrix data={preparedCorrelations} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CorrelationSection;
