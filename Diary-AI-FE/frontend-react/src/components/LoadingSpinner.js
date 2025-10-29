import React from 'react';

const LoadingSpinner = ({ 
  message = 'Loading...', 
  size = 'medium',
  fullScreen = false 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'spinner-small';
      case 'large':
        return 'spinner-large';
      default:
        return 'spinner-medium';
    }
  };

  const content = (
    <div className={`loading-container ${fullScreen ? 'loading-fullscreen' : ''}`}>
      <div className={`spinner ${getSizeClasses()}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <div className="loading-message">{message}</div>}

  <style>{`
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          gap: 16px;
        }

        .loading-fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .dark .loading-fullscreen {
          background: rgba(15, 23, 42, 0.9);
        }

        .spinner {
          position: relative;
          display: inline-block;
        }

        .spinner-small {
          width: 32px;
          height: 32px;
        }

        .spinner-medium {
          width: 48px;
          height: 48px;
        }

        .spinner-large {
          width: 64px;
          height: 64px;
        }

        .spinner-ring {
          position: absolute;
          border: 3px solid transparent;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .spinner-small .spinner-ring {
          width: 32px;
          height: 32px;
          border-width: 2px;
          border-top-width: 2px;
        }

        .spinner-medium .spinner-ring {
          width: 48px;
          height: 48px;
          border-width: 3px;
          border-top-width: 3px;
        }

        .spinner-large .spinner-ring {
          width: 64px;
          height: 64px;
          border-width: 4px;
          border-top-width: 4px;
        }

        .spinner-ring:nth-child(1) {
          animation-delay: -0.45s;
          border-top-color: #3b82f6;
        }

        .spinner-ring:nth-child(2) {
          animation-delay: -0.3s;
          border-top-color: #10b981;
        }

        .spinner-ring:nth-child(3) {
          animation-delay: -0.15s;
          border-top-color: #f59e0b;
        }

        .spinner-ring:nth-child(4) {
          animation-delay: 0s;
          border-top-color: #ef4444;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .loading-message {
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 500;
          text-align: center;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .dark .loading-message {
          color: #94a3b8;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        /* Alternative spinner styles */
        .spinner.dots {
          display: flex;
          gap: 4px;
        }

        .spinner.dots .spinner-ring {
          position: static;
          width: 8px;
          height: 8px;
          border: none;
          background: #3b82f6;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite both;
        }

        .spinner.dots .spinner-ring:nth-child(1) { animation-delay: -0.32s; }
        .spinner.dots .spinner-ring:nth-child(2) { animation-delay: -0.16s; }
        .spinner.dots .spinner-ring:nth-child(3) { animation-delay: 0s; }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        /* Pulse spinner */
        .spinner.pulse .spinner-ring {
          border: none;
          background: #3b82f6;
          animation: pulse-scale 1s ease-in-out infinite;
        }

        @keyframes pulse-scale {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );

  return content;
};

// Alternative spinner components
export const DotsSpinner = ({ message, size = 'medium' }) => (
  <LoadingSpinner message={message} size={size} />
);

export const PulseSpinner = ({ message, size = 'medium' }) => (
  <div className="loading-container">
    <div className={`spinner pulse spinner-${size}`}>
      <div className="spinner-ring"></div>
    </div>
    {message && <div className="loading-message">{message}</div>}
  </div>
);

// Skeleton loader component
export const SkeletonLoader = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  className = '' 
}) => (
  <div 
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius }}
  >
  <style>{`
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
      }

      .dark .skeleton {
        background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
        background-size: 200% 100%;
      }

      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

// Card skeleton
export const CardSkeleton = () => (
  <div className="card">
    <div className="card-skeleton">
      <SkeletonLoader height="24px" width="60%" />
      <SkeletonLoader height="16px" width="40%" />
      <div style={{ marginTop: '16px' }}>
        <SkeletonLoader height="200px" width="100%" />
      </div>
    </div>

  <style>{`
      .card-skeleton {
        padding: 24px;
      }
    `}</style>
  </div>
);

export default LoadingSpinner;