import React from 'react';

/**
 * Unified tooltip for charts and generic hover content.
 * Usage with Recharts: <Tooltip content={<ChartTooltip mapPayload={mapper} />} />
 * Props:
 *  - active, payload, label: passed by Recharts
 *  - items: optional array of { label, value, color }
 *  - title: optional top title string (defaults to label)
 *  - mapPayload: optional function ({ payload, label, active }) => ({ title, items })
 */
const ChartTooltip = ({ active, payload, label, items, title, mapPayload }) => {
  let renderItems = items;
  let renderTitle = title ?? label;

  if (!renderItems && typeof mapPayload === 'function') {
    try {
      const res = mapPayload({ payload, label, active });
      if (res) {
        renderItems = res.items ?? renderItems;
        renderTitle = res.title ?? renderTitle;
      }
    } catch (e) {
      // swallow mapping errors, show nothing
    }
  }

  if (!active || !(renderItems && renderItems.length)) return null;

  return (
    <div className="custom-tooltip tooltip-glass" style={{ pointerEvents: 'none' }}>
      {renderTitle != null && (
        <p className="tooltip-label">{String(renderTitle)}</p>
      )}
      {renderItems.map((r, i) => (
        <p key={i} className="tooltip-value" style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          {r.color && (<span className="tooltip-metric" style={{ color: r.color }}>{r.label}:</span>)}
          {!r.color && (<span className="tooltip-metric">{r.label}:</span>)}
          <span className="tooltip-number">{r.value}</span>
        </p>
      ))}
    </div>
  );
};

export default ChartTooltip;
