import React, { useState, useRef, useEffect } from 'react';

/**
 * Simple accessible tooltip with configurable delay.
 * Props:
 *  - content: ReactNode | string (tooltip body)
 *  - delay: ms before show (default 350)
 *  - placement: top|bottom (default top)
 *  - maxWidth: css size (default 240px)
 */
const Tooltip = ({ children, content, delay = 350, placement = 'top', maxWidth = '240px' }) => {
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const timeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (hovering) {
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      clearTimeout(timeoutRef.current);
      setVisible(false);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [hovering, delay]);

  return (
    <span
      ref={wrapperRef}
      className="tooltip-wrapper"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`tooltip-bubble tooltip-${placement}`}
          style={{
            position: 'absolute',
            zIndex: 50,
            [placement === 'top' ? 'bottom' : 'top']: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: placement === 'top' ? 0 : 8,
            marginBottom: placement === 'top' ? 8 : 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.28))',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px) saturate(120%)',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
            boxShadow: 'var(--glass-shadow)',
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: '0.70rem',
            lineHeight: 1.3,
            maxWidth,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
