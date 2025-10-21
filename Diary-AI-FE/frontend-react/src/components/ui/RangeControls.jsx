import React from 'react';
import Button from './Button';

/**
 * Unified range/rolling controls used across pages.
 * Props:
 * - days: number
 * - onChangeDays: (n:number) => void
 * - options?: number[] (defaults [7,14,30,60,90])
 * - rolling?: boolean
 * - onToggleRolling?: () => void
 * - showRolling?: boolean
 * - onRefresh?: () => void
 * - className?: string
 */
const RangeControls = ({
  days,
  onChangeDays,
  options = [7, 14, 30, 60, 90],
  rolling = false,
  onToggleRolling,
  showRolling = false,
  onRefresh,
  className = '',
}) => {
  return (
    <div className={`control-group ${className}`.trim()} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div className="control-pill" title="Change range" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <label className="text-sm" style={{ color: 'inherit' }}>Range</label>
        <select value={days} onChange={(e) => onChangeDays(Number(e.target.value))} className="select-glass select-sm" aria-label="Days range">
          {options.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      {showRolling && typeof onToggleRolling === 'function' && (
        <button className={`btn ${rolling ? 'btn-primary' : ''}`} onClick={onToggleRolling} title="Toggle rolling window">
          Rolling
        </button>
      )}
      {typeof onRefresh === 'function' && (
        <Button variant="primary" size="sm" onClick={onRefresh}>Refresh</Button>
      )}
      <style jsx>{`
        /* Generic glass pill used for compact controls */
        .control-pill {
          padding: 6px 10px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(var(--glass-blur)) saturate(120%);
          -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(120%);
          color: var(--text-primary);
          box-shadow: 0 6px 18px rgba(2,6,23,0.35);
        }
      `}</style>
    </div>
  );
};

export default RangeControls;
