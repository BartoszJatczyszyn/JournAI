import React from 'react';

/*
  Generic rating input (now adapted for 1–5 scale by default).
  Props:
    label: string
    value: number|null
    onChange: (number|null) => void
    hideZero?: boolean (default false)
    disabled?: boolean
    compact?: boolean
    allowClear?: boolean (click same value to clear)

  Color scale (1–5):
    1 -> #ef4444 (red)
    2 -> #f97316 (orange)
    3 -> #eab308 (amber)
    4 -> #10b981 (emerald)
    5 -> #22c55e (green)
*/

function colorFor(v) {
  if (v == null) return '#334155';
  if (v <= 1) return '#ef4444';
  if (v <= 2) return '#f97316';
  if (v <= 3) return '#eab308';
  if (v <= 4) return '#10b981';
  return '#22c55e';
}

export default function RatingInput({ label, value, onChange, hideZero: _hideZero=false, disabled=false, compact=false, allowClear=true, descriptors }) {
  // Force 1..5 range irrespective of hideZero (DB constraint)
  const min = 1;
  const max = 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  // default descriptors if not provided (index = value - 1)
  const defaultDescriptors = ['Very Poor', 'Poor', 'OK', 'Good', 'Excellent'];
  const desc = descriptors || defaultDescriptors;

  const handleKey = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nv = value == null ? min : Math.min(max, value + 1);
      onChange(nv);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nv = value == null ? min : Math.max(min, value - 1);
      onChange(nv);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (allowClear) {
        e.preventDefault();
        onChange(null);
      }
    } else if (/^[1-5]$/.test(e.key)) {
      const digit = Number(e.key);
      if (digit >= min && digit <= max) onChange(digit);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  {label && <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}{value!=null && <span style={{ color: colorFor(value), marginLeft: 4 }}>({value})</span>}</span>}
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        tabIndex={0}
        onKeyDown={handleKey}
        style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', outline: 'none' }}
      >
        {values.map(v => {
          const active = value === v;
            const d = desc[v-1] || '';
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(active && allowClear ? null : v)}
                title={`${v} – ${d}`}
                disabled={disabled}
                style={{
                  width: compact ? 18 : 22,
                  height: compact ? 18 : 22,
                  borderRadius: '50%',
                  border: active ? '2px solid #e2e8f0' : '1px solid #475569',
                  background: colorFor(v),
                  opacity: active ? 1 : 0.65,
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 0 2px #1e293b, 0 0 0 3px #e2e8f0' : 'none',
                  transition: 'all 120ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1
                }}
              >
                {v}
              </button>
            );
        })}
      </div>
  {/* Hint text removed as per request */}
    </div>
  );
}
