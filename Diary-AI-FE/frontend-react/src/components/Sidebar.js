import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      icon: '📊',
      label: 'Dashboard',
      description: 'Overview & key metrics'
    },
    {
      path: '/analytics',
      icon: '🧠',
      label: 'Enhanced Analytics',
      description: 'AI-powered insights'
    },
    {
      path: '/predictions',
      icon: '🔮',
      label: 'Predictions',
      description: 'Future trends & forecasts'
    },
    {
      path: '/sleep',
      icon: '😴',
      label: 'Sleep Analysis',
      description: 'Sleep patterns & quality'
    },
    {
      path: '/stress',
      icon: '😰',
      label: 'Stress Analysis',
      description: 'Stress patterns & triggers'
    },
    {
      path: '/sleeps',
      icon: '🛌',
      label: 'Sleeps',
      description: 'Latest sleep sessions'
    },
    {
      path: '/days',
      icon: '📅',
      label: 'Days',
      description: 'Daily summaries'
    },
    {
      path: '/activity',
      icon: '🏃',
      label: 'Activity Analysis',
      description: 'Exercise & movement'
    },
    {
      path: '/insights',
      icon: '💡',
      label: 'Personalized Insights',
      description: 'Custom recommendations'
    },
    {
      path: '/settings',
      icon: '⚙️',
      label: 'Settings',
      description: 'Configuration & preferences'
    }
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}
      
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span className="sidebar-icon">🏥</span>
            <span className="sidebar-text">Health Analytics</span>
          </div>
          <button className="sidebar-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {menuItems.map((item) => (
              <li key={item.path} className="nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => 
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                  onClick={onClose}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <div className="nav-content">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-description">{item.description}</span>
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="footer-info">
            <div className="footer-title">Enhanced Analytics v1.0</div>
            <div className="footer-subtitle">AI-powered health insights</div>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          opacity: 0;
          animation: fadeIn 0.3s ease forwards;
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        .sidebar {
          position: fixed;
          top: 64px;
          left: 0;
          width: 280px;
          height: calc(100vh - 64px);
          background: white;
          border-right: 1px solid #e2e8f0;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .sidebar-open {
          transform: translateX(0);
        }

        .dark .sidebar {
          background: #1e293b;
          border-right-color: #334155;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .sidebar-header {
          border-bottom-color: #334155;
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          color: #1e293b;
        }

        .dark .sidebar-title {
          color: #f1f5f9;
        }

        .sidebar-icon {
          font-size: 1.5rem;
        }

        .sidebar-text {
          font-size: 1.125rem;
        }

        .sidebar-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: none;
          color: #64748b;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sidebar-close:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .dark .sidebar-close:hover {
          background: #334155;
          color: #f1f5f9;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 0;
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .nav-item {
          margin: 0;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 24px;
          color: #64748b;
          text-decoration: none;
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }

        .nav-link:hover {
          background: #f8fafc;
          color: #1e293b;
          border-left-color: #e2e8f0;
        }

        .nav-link-active {
          background: #eff6ff;
          color: #2563eb;
          border-left-color: #2563eb;
        }

        .dark .nav-link:hover {
          background: #334155;
          color: #f1f5f9;
          border-left-color: #475569;
        }

        .dark .nav-link-active {
          background: #1e3a8a;
          color: #93c5fd;
          border-left-color: #60a5fa;
        }

        .nav-icon {
          font-size: 1.25rem;
          width: 20px;
          text-align: center;
        }

        .nav-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-label {
          font-weight: 500;
          font-size: 0.875rem;
        }

        .nav-description {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .sidebar-footer {
          padding: 20px 24px;
          border-top: 1px solid #e2e8f0;
        }

        .dark .sidebar-footer {
          border-top-color: #334155;
        }

        .footer-info {
          text-align: center;
        }

        .footer-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .dark .footer-title {
          color: #f1f5f9;
        }

        .footer-subtitle {
          font-size: 0.75rem;
          color: #64748b;
        }

        .dark .footer-subtitle {
          color: #94a3b8;
        }

        .w-5 {
          width: 1.25rem;
        }

        .h-5 {
          height: 1.25rem;
        }

        @media (min-width: 769px) {
          .sidebar-overlay {
            display: none;
          }

          .sidebar-close {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            max-width: 320px;
          }
        }

        /* Custom scrollbar for sidebar */
        .sidebar::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .sidebar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .dark .sidebar::-webkit-scrollbar-thumb {
          background: #475569;
        }

        .dark .sidebar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </>
  );
};

export default Sidebar;