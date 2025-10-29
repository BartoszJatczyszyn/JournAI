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
    <div className="custom-tooltip tooltip-glass refined-tooltip" style={{ pointerEvents: 'none' }}>
      {renderTitle != null && (
        <p className="tooltip-label refined-tooltip-title">{String(renderTitle)}</p>
      )}
      <div className="refined-tooltip-body">
        {renderItems.map((r, i) => (
          <div key={i} className="tooltip-value refined-tooltip-row" style={{ alignItems: 'center' }}>
            <span className="tooltip-metric refined-tooltip-metric" style={r.color?{ color: r.color }:{}}>{r.label}</span>
            <span className="tooltip-number refined-tooltip-value">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartTooltip;
