import React from 'react';

const ErrorMessage = ({ 
  message = 'An error occurred', 
  onRetry,
  type = 'error',
  showIcon = true,
  className = ''
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-500',
          buttonColor: 'btn-warning'
        };
      case 'info':
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-500',
          buttonColor: 'btn-primary'
        };
      case 'success':
        return {
          icon: '✅',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-500',
          buttonColor: 'btn-success'
        };
      default: // error
        return {
          icon: '❌',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-500',
          buttonColor: 'btn-danger'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div className={`error-message ${config.bgColor} ${config.borderColor} ${config.textColor} ${className}`}>
      <div className="error-content">
        {showIcon && (
          <div className={`error-icon ${config.iconColor}`}>
            {config.icon}
          </div>
        )}
        <div className="error-text">
          <div className="error-title">
            {type === 'warning' && 'Warning'}
            {type === 'info' && 'Information'}
            {type === 'success' && 'Success'}
            {type === 'error' && 'Error'}
          </div>
          <div className="error-message-text">{message}</div>
        </div>
      </div>
      
      {onRetry && (
        <div className="error-actions">
          <button 
            onClick={onRetry}
            className={`btn ${config.buttonColor} btn-sm`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      )}

      <style jsx>{`
        .error-message {
          border: 1px solid;
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .error-message:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .error-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1;
        }

        .error-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .error-text {
          flex: 1;
        }

        .error-title {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .error-message-text {
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .error-actions {
          flex-shrink: 0;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 0.75rem;
        }

        .w-4 {
          width: 1rem;
        }

        .h-4 {
          height: 1rem;
        }

        .mr-2 {
          margin-right: 0.5rem;
        }

        /* Dark mode styles */
        .dark .bg-red-50 {
          background-color: #7f1d1d;
        }

        .dark .border-red-200 {
          border-color: #991b1b;
        }

        .dark .text-red-800 {
          color: #fca5a5;
        }

        .dark .text-red-500 {
          color: #f87171;
        }

        .dark .bg-yellow-50 {
          background-color: #451a03;
        }

        .dark .border-yellow-200 {
          border-color: #92400e;
        }

        .dark .text-yellow-800 {
          color: #fbbf24;
        }

        .dark .text-yellow-500 {
          color: #f59e0b;
        }

        .dark .bg-blue-50 {
          background-color: #1e3a8a;
        }

        .dark .border-blue-200 {
          border-color: #2563eb;
        }

        .dark .text-blue-800 {
          color: #93c5fd;
        }

        .dark .text-blue-500 {
          color: #60a5fa;
        }

        .dark .bg-green-50 {
          background-color: #14532d;
        }

        .dark .border-green-200 {
          border-color: #166534;
        }

        .dark .text-green-800 {
          color: #bbf7d0;
        }

        .dark .text-green-500 {
          color: #4ade80;
        }

        @media (max-width: 768px) {
          .error-message {
            flex-direction: column;
            align-items: stretch;
          }

          .error-actions {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

// Specialized error components
export const NetworkError = ({ onRetry }) => (
  <ErrorMessage
    type="error"
    message="Unable to connect to the server. Please check your internet connection and try again."
    onRetry={onRetry}
  />
);

export const DataError = ({ onRetry }) => (
  <ErrorMessage
    type="warning"
    message="There was an issue loading your health data. Some features may not work correctly."
    onRetry={onRetry}
  />
);

export const APIError = ({ message, onRetry }) => (
  <ErrorMessage
    type="error"
    message={message || "The health analytics service is currently unavailable. Please try again later."}
    onRetry={onRetry}
  />
);

export const NoDataMessage = ({ message, icon = "📊" }) => (
  <div className="no-data-message">
    <div className="no-data-icon">{icon}</div>
    <div className="no-data-text">
      {message || "No data available"}
    </div>
    <div className="no-data-subtitle">
      Data will appear here once it's available
    </div>

    <style jsx>{`
      .no-data-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
        color: #64748b;
      }

      .dark .no-data-message {
        color: #94a3b8;
      }

      .no-data-icon {
        font-size: 3rem;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .no-data-text {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 8px;
        color: #374151;
      }

      .dark .no-data-text {
        color: #d1d5db;
      }

      .no-data-subtitle {
        font-size: 0.875rem;
        opacity: 0.7;
      }
    `}</style>
  </div>
);

// Toast-style error for temporary notifications
export const ToastError = ({ message, onClose, autoClose = true }) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  return (
    <div className="toast-error">
      <div className="toast-content">
        <div className="toast-icon">❌</div>
        <div className="toast-message">{message}</div>
      </div>
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <style jsx>{`
        .toast-error {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 400px;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        .dark .toast-error {
          background: #1f2937;
          border-color: #991b1b;
          color: #f9fafb;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .toast-icon {
          font-size: 1rem;
        }

        .toast-message {
          font-size: 0.875rem;
          color: #dc2626;
        }

        .dark .toast-message {
          color: #fca5a5;
        }

        .toast-close {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .toast-close:hover {
          background: #f3f4f6;
        }

        .dark .toast-close {
          color: #9ca3af;
        }

        .dark .toast-close:hover {
          background: #374151;
        }

        .w-4 {
          width: 1rem;
        }

        .h-4 {
          height: 1rem;
        }
      `}</style>
    </div>
  );
};

export default ErrorMessage;