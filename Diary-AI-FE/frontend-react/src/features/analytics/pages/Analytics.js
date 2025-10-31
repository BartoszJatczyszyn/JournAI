import React, { useEffect, useState, useMemo } from 'react';
import { RangeControls } from 'shared/ui';
import Tooltip from 'components/Tooltip';
import { useHealthData } from 'app/providers/HealthDataProvider';
// LoadingSpinner and ErrorMessage are not used in this file
import CorrelationMatrix from 'components/CorrelationMatrix';
import CorrelationHeatmap from 'components/CorrelationHeatmap';
import ClusterAnalysis from 'components/ClusterAnalysis';
import TemporalPatterns from 'components/TemporalPatterns';
import RecoveryAnalysis from 'components/RecoveryAnalysis';

const Analytics = () => {
  const { 
    analytics, 
    loading, 
    error, 
    fetchAnalytics 
  } = useHealthData();

  const [activeTab, setActiveTab] = useState('correlations');
  const [corrMethod, setCorrMethod] = useState('auto'); // auto = significant list or best per pair
  const [corrThreshold, setCorrThreshold] = useState(0.3);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [analysisParams, setAnalysisParams] = useState(() => {
    let days = 90;
    let clusters = 3;
    try {
      const savedDays = localStorage.getItem('analytics_period_days');
      const savedClusters = localStorage.getItem('analytics_clusters');
      const parsedDays = savedDays ? parseInt(savedDays) : NaN;
      const parsedClusters = savedClusters ? parseInt(savedClusters) : NaN;
      if (!isNaN(parsedDays)) days = parsedDays;
      if (!isNaN(parsedClusters)) clusters = parsedClusters;
    } catch (e) {
      // ignore storage errors
    }
    return { days, clusters };
  });

  // Build correlation items early so hook order is consistent across renders
  // (must be declared BEFORE any conditional return like loading/error states)
  const correlationItems = useMemo(() => {
    const src = analytics?.correlations;
    if (!src) return [];
    const root = src.correlations || src;
    let baseList = [];
    if (corrMethod === 'auto' && (root.significant_correlations || src.significant_correlations)) {
      baseList = root.significant_correlations || src.significant_correlations || [];
    } else {
      const methods = ['pearson','spearman','kendall'];
      const selectedMethods = corrMethod === 'auto' ? methods : [corrMethod];
      const rows = [];
      selectedMethods.forEach(m => {
        const matrix = root[m];
        if (matrix && typeof matrix === 'object') {
          Object.keys(matrix).forEach(a => {
            const row = matrix[a];
            if (row && typeof row === 'object') {
              Object.keys(row).forEach(b => {
                if (a === b) return;
                const val = row[b];
                if (val == null || Number.isNaN(val)) return;
                rows.push({ field1: a, field2: b, correlation: val, method: m });
              });
            }
          });
        }
      });
      if (corrMethod === 'auto') {
        const bestMap = new Map();
        rows.forEach(r => {
          const key = r.field1 < r.field2 ? `${r.field1}|${r.field2}` : `${r.field2}|${r.field1}`;
          const existing = bestMap.get(key);
          if (!existing || Math.abs(r.correlation) > Math.abs(existing.correlation)) {
            bestMap.set(key, r);
          }
        });
        baseList = Array.from(bestMap.values());
      } else {
        baseList = rows;
      }
    }
    return baseList.filter(i => Math.abs(i.correlation) >= corrThreshold);
  }, [analytics, corrMethod, corrThreshold]);

  // Extract a correlation matrix for the heatmap with fallbacks.
  const selectedCorrMatrix = useMemo(() => {
    const src = analytics?.correlations;
    if (!src) return null;
    const root = src.correlations || src; // inner object with pearson/spearman/kendall keys
    const methodKey = corrMethod === 'auto' ? 'pearson' : corrMethod;
    let matrix = root[methodKey];

    // Helper to detect if matrix-like object has any numeric cells
    const hasNumericCells = (m) => {
      if (!m || typeof m !== 'object') return false;
      for (const a of Object.keys(m)) {
        const row = m[a];
        if (row && typeof row === 'object') {
          for (const b of Object.keys(row)) {
            const v = row[b];
            if (typeof v === 'number' && !Number.isNaN(v)) return true;
          }
        }
      }
      return false;
    };

    if (hasNumericCells(matrix)) return matrix;

    // Fallback: build synthetic matrix from significant_correlations or correlationItems list
    const pairs = (root.significant_correlations && Array.isArray(root.significant_correlations) && root.significant_correlations.length)
      ? root.significant_correlations
      : correlationItems;
    if (!pairs || !pairs.length) return null;
    const fields = new Set();
    pairs.forEach(p => { if (p.field1) fields.add(p.field1); if (p.field2) fields.add(p.field2); });
    if (!fields.size) return null;
    const synthetic = {};
    fields.forEach(a => { synthetic[a] = {}; fields.forEach(b => { if (a === b) synthetic[a][b] = 1.0; }); });
    pairs.forEach(p => {
      if (typeof p.correlation === 'number' && !Number.isNaN(p.correlation)) {
        if (!synthetic[p.field1]) synthetic[p.field1] = {};
        if (!synthetic[p.field2]) synthetic[p.field2] = {};
        synthetic[p.field1][p.field2] = p.correlation;
        synthetic[p.field2][p.field1] = p.correlation; // symmetry
      }
    });
    return hasNumericCells(synthetic) ? synthetic : null;
  }, [analytics, corrMethod, correlationItems]);

  useEffect(() => {
    if (!analytics) {
      fetchAnalytics(analysisParams.days, analysisParams.clusters);
    }
  }, [analytics, fetchAnalytics, analysisParams.days, analysisParams.clusters]);

  const handleRefresh = () => {
    fetchAnalytics(analysisParams.days, analysisParams.clusters);
  };

  const handleParamsChange = (newParams) => {
    setAnalysisParams(prev => ({ ...prev, ...newParams }));
    try {
      if (newParams.days !== undefined) {
        localStorage.setItem('analytics_period_days', String(newParams.days));
      }
      if (newParams.clusters !== undefined) {
        localStorage.setItem('analytics_clusters', String(newParams.clusters));
      }
    } catch (e) {
      // ignore storage errors
    }
    fetchAnalytics(newParams.days || analysisParams.days, newParams.clusters || analysisParams.clusters);
  };

  // Don't early-return before hooks above; render conditional content instead
  const initialLoading = loading && !analytics;
  const _initialError = error && !analytics;
  // reference to avoid unused-var ESLint warning for initialLoading
  void initialLoading;
  // also reference _initialError to explicitly mark it as intentionally unused
  void _initialError;

  const tabs = [
    {
      id: 'correlations',
      label: 'Advanced Correlations',
      icon: '🔗',
      description: 'Multi-dimensional relationship analysis'
    },
    {
      id: 'clusters',
      label: 'Health Patterns',
      icon: '📊',
      description: 'AI-powered pattern recognition'
    },
    {
      id: 'temporal',
      label: 'Temporal Analysis',
      icon: '📅',
      description: 'Time-based pattern discovery'
    },
    {
      id: 'recovery',
      label: 'Recovery Analysis',
      icon: '💪',
      description: 'Comprehensive recovery insights'
    }
  ];


  const renderTabContent = () => {
    switch (activeTab) {
      case 'correlations':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h3>Advanced Correlation Analysis</h3>
              <p>Discover complex relationships between your health metrics using multiple correlation methods</p>
            </div>
            
            {analytics?.correlations ? (
              <div className="correlations-container">
                <div className="correlation-stats">
                  <div className="stat-card">
                    <div className="stat-value">
                      {correlationItems.length}
                    </div>
                    <div className="stat-label">Significant Correlations</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {analytics.correlations.data_points || 0}
                    </div>
                    <div className="stat-label">Data Points Analyzed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {analysisParams.days}
                    </div>
                    <div className="stat-label">Days Period</div>
                  </div>
                </div>

                <div className="correlation-methods">
                  <div className="method-tabs" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {['auto','pearson','spearman','kendall'].map(m => {
                      const help = {
                        auto: 'Auto: show significant correlations (p<0.05 & |r| >= threshold) or the strongest method per pair.',
                        pearson: 'Pearson: linear correlation; best for approximately linear relationships, sensitive to outliers.',
                        spearman: 'Spearman: rank correlation; captures monotonic non-linear relationships.',
                        kendall: 'Kendall tau: more conservative and robust to outliers; useful with small samples.'
                      };
                      return (
                        <Tooltip key={m} content={help[m]}>
                          <button
                            className={`method-tab ${corrMethod === m ? 'active' : ''}`}
                            onClick={() => setCorrMethod(m)}
                            aria-label={help[m]}
                          >{m === 'auto' ? 'Auto' : m.charAt(0).toUpperCase()+m.slice(1)}</button>
                        </Tooltip>
                      );
                    })}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft: 'auto' }}>
                      <Tooltip placement="top" content="Minimum absolute correlation coefficient; lower = more pairs displayed.">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Min |r|:</label>
                      </Tooltip>
                      <select value={corrThreshold} onChange={(e)=> setCorrThreshold(parseFloat(e.target.value))} className="method-tab" style={{ padding:'4px 8px' }} aria-label="Minimum correlation threshold">
                        <option value={0.1}>0.10</option>
                        <option value={0.2}>0.20</option>
                        <option value={0.3}>0.30</option>
                        <option value={0.4}>0.40</option>
                        <option value={0.5}>0.50</option>
                        <option value={0.6}>0.60</option>
                        <option value={0.7}>0.70</option>
                      </select>
                      <button onClick={()=> setShowHeatmap(h=>!h)} className="method-tab" style={{ padding:'4px 12px' }}>
                        {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="correlation-layout">
                  {showHeatmap && (
                    <div className="heatmap-panel">
                      {selectedCorrMatrix ? (
                        <CorrelationHeatmap
                          matrix={selectedCorrMatrix}
                          method={corrMethod === 'auto' ? 'pearson' : corrMethod}
                        />
                      ) : (
                        <div style={{ padding:16, fontSize:12, color:'#64748b', lineHeight:1.4 }}>
                          No raw correlation matrix for the selected method.
                          <br/>FALLBACK: {correlationItems.length ? 'List of correlations available (synthetic matrix lacks enough fields).' : 'No correlation pairs meeting the threshold.'}
                          <br/>Try: lower the |r| threshold, increase the days window, or refresh analysis.
                        </div>
                      )}
                      <div className="methods-explained">
                        <div className="methods-header">Methods explained</div>
                        <ul className="methods-list">
                          <li><span className="m-name">Pearson</span> linear relationship (best for approximately normal, linear data).</li>
                          <li><span className="m-name">Spearman</span> rank-based; detects monotonic (even non-linear) trends.</li>
                          <li><span className="m-name">Kendall</span> tau; more stable with small samples and outliers.</li>
                          <li><span className="m-name">Auto</span> significant (p &lt; 0.05) or strongest |r| per pair.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  <div className="matrix-panel">
                    <CorrelationMatrix data={correlationItems} maxItems={50} selectedMethod={corrMethod} minAbs={corrThreshold} />
                  </div>
                </div>

                {(analytics.correlations.correlations?.insights || analytics.correlations?.insights) && (
                  <div className="insights-section">
                    <h4>Key Insights</h4>
                    <div className="insights-list">
                      {(analytics.correlations.correlations?.insights || analytics.correlations?.insights || []).map((insight, index) => (
                        <div key={index} className="insight-card">
                          <div className="insight-icon">💡</div>
                          <div className="insight-text">{insight}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-data">No correlation data available</div>
            )}
          </div>
        );

      case 'clusters':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h3>Health Pattern Clusters</h3>
              <p>AI-powered clustering identifies distinct health behavior patterns in your data</p>
            </div>
            
            <div className="cluster-controls">
              <label>
                Number of clusters:
                <select 
                  value={analysisParams.clusters}
                  onChange={(e) => handleParamsChange({ clusters: parseInt(e.target.value) })}
                >
                  <option value={2}>2 clusters</option>
                  <option value={3}>3 clusters</option>
                  <option value={4}>4 clusters</option>
                  <option value={5}>5 clusters</option>
                </select>
              </label>
            </div>

            {analytics?.clusters ? (
              <ClusterAnalysis data={analytics.clusters} />
            ) : (
              <div className="no-data">No cluster data available</div>
            )}
          </div>
        );

      case 'temporal':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h3>Temporal Pattern Analysis</h3>
              <p>Discover how your health metrics vary by day of week and over time</p>
            </div>
            
            {analytics?.temporal ? (
              <TemporalPatterns data={analytics.temporal} />
            ) : (
              <div className="no-data">No temporal data available</div>
            )}
          </div>
        );

      case 'recovery':
        return (
          <div className="tab-content">
            <div className="content-header">
              <h3>Recovery Pattern Analysis</h3>
              <p>Comprehensive analysis of your recovery patterns and optimization opportunities</p>
            </div>
            
            {analytics?.recovery ? (
              <>
                <RecoveryAnalysis data={analytics.recovery} periodDays={analysisParams.days} />
              </>
            ) : (
              <div className="no-data">No recovery data available</div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="analytics-page fade-in">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">🧠</span>
            Enhanced Analytics
          </h1>
          <p className="page-subtitle">
            AI-powered insights and advanced statistical analysis of your health data
          </p>
        </div>
        
        <div className="header-controls">
          <RangeControls
            days={analysisParams.days}
            onChangeDays={(n) => handleParamsChange({ days: n })}
            options={[30,60,90]}
            onRefresh={handleRefresh}
          />
        </div>
      </div>

      <div className="analytics-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <div className="tab-content">
              <div className="tab-label">{tab.label}</div>
              <div className="tab-description">{tab.description}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="analytics-content">
        {renderTabContent()}
      </div>

  <style>{`
        .analytics-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .dark .page-header {
          border-bottom-color: #334155;
        }

        .header-content {
          flex: 1;
        }

        .page-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .dark .page-title {
          color: #f1f5f9;
        }

        .title-icon {
          font-size: 2.5rem;
        }

        .page-subtitle {
          color: #64748b;
          margin: 0;
          font-size: 1rem;
        }

        .dark .page-subtitle {
          color: #94a3b8;
        }

        .header-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .period-select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #1e293b;
          font-size: 0.875rem;
        }

        .dark .period-select {
          background: #334155;
          border-color: #475569;
          color: #f1f5f9;
        }

        .analytics-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: left;
        }

        .tab:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .tab.active {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .dark .tab {
          background: #1e293b;
          border-color: #334155;
        }

        .dark .tab:hover {
          border-color: #475569;
        }

        .dark .tab.active {
          border-color: #60a5fa;
          background: #1e3a8a;
        }

        .tab-icon {
          font-size: 1.5rem;
        }

        .tab-content {
          flex: 1;
        }

        .tab-label {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .dark .tab-label {
          color: #f1f5f9;
        }

        .tab.active .tab-label {
          color: #2563eb;
        }

        .dark .tab.active .tab-label {
          color: #93c5fd;
        }

        .tab-description {
          font-size: 0.875rem;
          color: #64748b;
        }

        .dark .tab-description {
          color: #94a3b8;
        }

        .analytics-content {
          background: white;
          border-radius: 16px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .dark .analytics-content {
          background: #1e293b;
        }

        .tab-content {
          padding: 32px;
        }

        .content-header {
          margin-bottom: 32px;
        }

        .content-header h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .dark .content-header h3 {
          color: #f1f5f9;
        }

        .content-header p {
          color: #64748b;
          margin: 0;
        }

        .dark .content-header p {
          color: #94a3b8;
        }

        .correlation-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }

        .dark .stat-card {
          background: #334155;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .dark .stat-value {
          color: #f1f5f9;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #64748b;
        }

        .dark .stat-label {
          color: #94a3b8;
        }

        .correlation-methods {
          margin-bottom: 24px;
        }
        .correlation-layout { display:flex; gap:24px; align-items:stretch; }
        .heatmap-panel { flex:0 0 320px; max-width:320px; }
        .matrix-panel { flex:1 1 auto; min-width:0; }
        @media (max-width: 1100px) {
          .correlation-layout { flex-direction:column; }
          .heatmap-panel { max-width:none; }
        }

        .method-tabs {
          display: flex;
          gap: 8px;
        }

        .method-tab {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .method-tab.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .dark .method-tab {
          background: #334155;
          border-color: #475569;
          color: #f1f5f9;
        }

        .insights-section {
          margin-top: 32px;
        }

        .insights-section h4 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .dark .insights-section h4 {
          color: #f1f5f9;
        }

        .insights-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .methods-explained {
          margin-top: 12px;
          background: linear-gradient(145deg,#ffffff,#f1f5f9);
          border: 1px solid #d0d7e2;
          padding: 14px 14px 12px 14px;
          border-radius: 10px;
          font-size: 11px;
          line-height: 1.45;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }
        .dark .methods-explained {
          background: linear-gradient(145deg,#1e293b,#0f172a);
          border-color: #334155;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .methods-header {
          font-weight: 600;
          font-size: 11px;
          letter-spacing: .5px;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 6px 0;
        }
        .dark .methods-header { color: #e2e8f0; }
        .methods-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
        .methods-list li { position: relative; padding-left: 14px; color: #475569; }
        .dark .methods-list li { color: #cbd5e1; }
        .methods-list li:before { content: ''; width:6px; height:6px; border-radius:50%; background:#3b82f6; position:absolute; left:0; top:6px; }
        .dark .methods-list li:before { background:#60a5fa; }
        .m-name { font-weight:600; color:#1e293b; margin-right:4px; }
        .dark .m-name { color:#f1f5f9; }

        .insight-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f0f9ff;
          border-left: 4px solid #3b82f6;
          border-radius: 0 8px 8px 0;
        }

        .dark .insight-card {
          background: #1e3a8a;
          border-left-color: #60a5fa;
        }

        .insight-icon {
          font-size: 1.25rem;
        }

        .insight-text {
          flex: 1;
          color: #1e293b;
          font-size: 0.875rem;
        }

        .dark .insight-text {
          color: #f1f5f9;
        }

        .cluster-controls {
          margin-bottom: 24px;
        }

        .cluster-controls label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 500;
          color: #374151;
        }

        .dark .cluster-controls label {
          color: #d1d5db;
        }

        .cluster-controls select {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
        }

        .dark .cluster-controls select {
          background: #334155;
          border-color: #475569;
          color: #f1f5f9;
        }

        .no-data {
          text-align: center;
          padding: 40px;
          color: #64748b;
          font-size: 1rem;
        }

        .dark .no-data {
          color: #94a3b8;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }

        .w-4 {
          width: 1rem;
        }

        .h-4 {
          height: 1rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: 16px;
          }

          .analytics-tabs {
            grid-template-columns: 1fr;
          }

          .tab-content {
            padding: 24px;
          }

          .correlation-stats {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default Analytics;