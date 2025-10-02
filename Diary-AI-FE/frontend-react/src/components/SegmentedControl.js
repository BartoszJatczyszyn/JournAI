import React from 'react';

/**
 * SegmentedControl
 * props:
 *  options: array of string | { value, label }
 *  value: current selected value
 *  onChange: (val) => void
 *  size: 'xs' | 'sm'
 *  ariaLabel: accessible label
 */
const sizeClasses = {
  xs: 'px-2 py-0.5 text-[11px]',
  sm: 'px-3 py-1 text-xs'
};

export default function SegmentedControl({ options = [], value, onChange, size='sm', ariaLabel='Segmented control', className='' }) {
  const norm = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  return (
    <div role="tablist" aria-label={ariaLabel} className={`inline-flex rounded overflow-hidden border shadow-sm ${className}`}>
      {norm.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active && onChange) onChange(opt.value); }}
            className={`${sizeClasses[size]} font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
