import React from 'react';

/**
 * Injects global tooltip styles (Sleep-style) once per page.
 * Use <TooltipStyles /> high in the component tree (e.g., page component) to enable.
 */
const TooltipStyles = () => (
  <style jsx global>{`
    .custom-tooltip {\n      background: var(--glass-bg, rgba(15,23,42,0.95));\n      backdrop-filter: blur(10px);\n      -webkit-backdrop-filter: blur(10px);\n      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));\n      box-shadow: var(--glass-shadow, 0 8px 24px rgba(0,0,0,0.35));\n      padding: 10px 12px;\n      border-radius: 10px;\n      min-width: 140px;\n      color: #0f172a;\n      font-size: 0.70rem;\n      line-height: 1.25;\n      pointer-events: none;\n      white-space: nowrap;\n      z-index: 60;\n    }\n    .dark .custom-tooltip { color: #f1f5f9; }\n    .custom-tooltip .tooltip-label { margin: 0 0 6px 0; font-weight: 600; font-size: 0.75rem; }\n    .custom-tooltip .tooltip-value { margin: 0 0 4px 0; display: flex; justify-content: space-between; gap: 12px; }\n    .custom-tooltip .tooltip-metric { color: #64748b; font-weight: 500; }\n    .dark .custom-tooltip .tooltip-metric { color: #94a3b8; }\n    .custom-tooltip .tooltip-number { font-weight: 600; color: #0ea5e9; }\n  `}</style>
);

export default TooltipStyles;
