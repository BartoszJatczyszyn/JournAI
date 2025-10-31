import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useHealthData } from 'app/providers/HealthDataProvider';

const Navbar = ({ onToggleSidebar, onToggleDarkMode, darkMode }) => {
  const { loading, refreshAllData } = useHealthData();
  const location = useLocation();
  const isToday = location.pathname === '/today';

  return (
    <nav className="navbar glass-navbar">
      <div className="navbar-content">
        <div className="navbar-left">
          <button
            className="sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          
          <div className="navbar-brand">
            <h1 className="brand-title">
              <span className="brand-icon">🏥</span>
              Garmin Health Analytics
            </h1>
            <span className="brand-subtitle">Enhanced AI Insights</span>
          </div>
          <div className="nav-quick-links">
            <Link to="/today" className={`quick-link ${isToday ? 'active' : ''}`} title="Dzisiejszy dziennik">
              <span className="ql-emoji">📝</span>
              <span className="ql-text">Today</span>
            </Link>
          </div>
        </div>

  <div className="navbar-right">
          <button
            className="navbar-btn"
            onClick={refreshAllData}
            disabled={loading}
            title="Refresh data"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'loading-spinner' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            className="navbar-btn"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          <div className="status-indicator">
            <div className={`status-dot ${loading ? 'status-loading' : 'status-online'}`}></div>
            <span className="status-text">
              {loading ? 'Loading...' : 'Online'}
            </span>
          </div>
        </div>
      </div>

  <style>{`
        .navbar {
          background: rgba(255,255,255,0.08);
          border-bottom: 1px solid var(--glass-border);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: var(--glass-shadow);
          height: 64px;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .dark .navbar {
          background:
            linear-gradient(180deg, rgba(15,23,42,0.55), rgba(2,6,23,0.38));
          border-bottom-color: rgba(148,163,184,0.20);
          box-shadow: 0 10px 28px rgba(0,0,0,0.30);
        }

        .navbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          padding: 0 24px;
          max-width: 100%;
        }

        .navbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .sidebar-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          background: none;
          color: #64748b;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sidebar-toggle:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .dark .sidebar-toggle:hover {
          background: #334155;
          color: #f1f5f9;
        }

        .navbar-brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .dark .brand-title {
          color: #f1f5f9;
        }

        .brand-icon {
          font-size: 1.5rem;
        }

        .brand-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
          margin-left: 32px;
        }

        .dark .brand-subtitle {
          color: #94a3b8;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-quick-links { display:flex; align-items:center; gap:8px; margin-left:16px; }
        .quick-link { display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:600; letter-spacing:.5px; text-transform:uppercase; padding:6px 10px; border-radius:24px; background:rgba(255,255,255,0.4); color:#1e293b; text-decoration:none; line-height:1; transition:all .25s ease; border:1px solid rgba(0,0,0,0.05); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
        .quick-link:hover { background:#f1f5f9; color:#0f172a; }
        .quick-link.active { background:#0f172a; color:#f1f5f9; box-shadow:0 4px 12px rgba(15,23,42,0.3); }
        .dark .quick-link { background:rgba(255,255,255,0.06); color:#e2e8f0; border:1px solid rgba(255,255,255,0.08); }
        .dark .quick-link:hover { background:#334155; color:#f8fafc; }
        .dark .quick-link.active { background:#2563eb; color:#f8fafc; border-color:#1d4ed8; }
        .ql-emoji { font-size:1rem; }
        .ql-text { letter-spacing:.5px; }

        @media (max-width: 840px){
          .nav-quick-links { display:none; }
        }

        .navbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          background: none;
          color: #64748b;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .navbar-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        

        .navbar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dark .navbar-btn:hover {
          background: #334155;
          color: #f1f5f9;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
        }

        .dark .status-indicator {
          background: #334155;
          border-color: #475569;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .status-online {
          background: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        }

        .status-loading {
          background: #f59e0b;
          animation: pulse 2s infinite;
        }

        .status-text {
          font-size: 0.75rem;
          font-weight: 500;
          color: #64748b;
        }

        .dark .status-text {
          color: #94a3b8;
        }

        .w-6 {
          width: 1.5rem;
        }

        .h-6 {
          height: 1.5rem;
        }

        .w-5 {
          width: 1.25rem;
        }

        .h-5 {
          height: 1.25rem;
        }

        @media (max-width: 768px) {
          .navbar-content {
            padding: 0 16px;
          }

          .brand-title {
            font-size: 1.125rem;
          }

          .brand-subtitle {
            display: none;
          }

          .status-text {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .brand-title {
            font-size: 1rem;
          }

          .brand-icon {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navbar;