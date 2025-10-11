import React from 'react';

/**
 * Injects global tooltip styles once per page. Mirrors App.css variables for consistency.
 * Use: place <TooltipStyles /> high in the tree (e.g., App or page component) to ensure styles load once.
 */
const TooltipStyles = () => (
  <style>{`
    .custom-tooltip {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(12px) saturate(120%);
      -webkit-backdrop-filter: blur(12px) saturate(120%);
      box-shadow: var(--glass-shadow);
      padding: 10px 12px;
      border-radius: 10px;
      min-width: 140px;
      color: var(--text-primary);
      font-size: 0.80rem;
      line-height: 1.35;
      pointer-events: none;
    }
    .custom-tooltip .tooltip-label { font-weight: 600; margin: 0 0 8px 0; color: var(--text-primary); }
    .custom-tooltip .tooltip-metric { color: var(--text-muted); }
    .custom-tooltip .tooltip-number { font-weight: 600; color: var(--text-primary); }
    .custom-tooltip .tooltip-extra { font-size: 0.875rem; color: var(--text-muted); }
  `}</style>
);

export default TooltipStyles;
