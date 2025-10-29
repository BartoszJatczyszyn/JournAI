import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const ClusterAnalysis = ({ data }) => {
  const clusterData = useMemo(() => {
    if (!data) return null;

    // Support two possible shapes:
    // 1) { clusters: { clusters: {...}, total_data_points, features_used } }
    // 2) { clusters: {...}, total_data_points, features_used }
    // Normalize to shape used by the UI.
    let raw = null;
    if (data.clusters && data.clusters.clusters) {
      raw = data.clusters; // nested shape
    } else if (data.clusters && !data.total_data_points) {
      // Some older responses may have {clusters: {...}} directly without metadata.
      raw = { clusters: data.clusters, total_data_points: data.total_data_points, features_used: data.features_used };
    } else if (data.clusters || data.total_data_points || data.features_used) {
      raw = data; // already flattened
    }

    if (!raw || !raw.clusters || Object.keys(raw.clusters).length === 0) return null;

    const totalDataPoints = raw.total_data_points || 0;
    const entries = Object.entries(raw.clusters);

    // If percentage not provided per cluster compute from sizes if possible.
    const totalSizeForPct = entries.reduce((acc, [, c]) => acc + (c.size || 0), 0) || 1;

    return {
      clusters: entries.map(([key, cluster], index) => ({
        id: key,
        name: cluster.name || `Cluster ${index + 1}`,
        size: cluster.size || 0,
        percentage: typeof cluster.percentage === 'number'
          ? cluster.percentage
          : Number(((cluster.size || 0) / totalSizeForPct * 100).toFixed(1)),
        characteristics: cluster.characteristics || {},
        interpretation: Array.isArray(cluster.interpretation) ? cluster.interpretation : (cluster.interpretation ? [cluster.interpretation] : []),
        color: getClusterColor(index)
      })),
      totalDataPoints,
      featuresUsed: raw.features_used || raw.featuresUsed || []
    };
  }, [data]);

  function getClusterColor(index) {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#ef4444', // red
      '#8b5cf6', // purple
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316'  // orange
    ];
    return colors[index % colors.length];
  }

  function formatMetricName(metric) {
    return metric
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Rhr', 'RHR')
      .replace('Hr', 'HR');
  }

  function getMetricUnit(metric) {
    const units = {
      steps: '',
      sleep_score: '/100',
      mood: '/5',
      energy_level: '/5',
      rhr: ' bpm',
      stress_avg: '/100'
    };
    return units[metric] || '';
  }

  const CustomTooltip = ({ active, payload, label: _label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${payload[0].payload.name}: ${payload[0].value}%`}</p>
          <p className="tooltip-desc">{`${payload[0].payload.size} data points`}</p>
        </div>
      );
    }
    return null;
  };

  if (!clusterData) {
    return (
      <div className="cluster-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">No cluster analysis data available</div>
      </div>
    );
  }

  return (
    <div className="cluster-analysis">
      {/* Overview */}
      <div className="cluster-overview">
        <div className="overview-stats">
          <div className="stat-item">
            <div className="stat-value">{clusterData.clusters.length}</div>
            <div className="stat-label">Health Patterns</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{clusterData.totalDataPoints}</div>
            <div className="stat-label">Data Points</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{clusterData.featuresUsed.length}</div>
            <div className="stat-label">Features Analyzed</div>
          </div>
        </div>

        <div className="features-used">
          <h4>Features Analyzed:</h4>
          <div className="feature-tags">
            {clusterData.featuresUsed.map((feature, _index) => (
              <span key={_index} className="feature-tag">
                {formatMetricName(feature)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cluster Distribution */}
      <div className="cluster-distribution">
        <div className="distribution-chart">
          <h4>Cluster Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={clusterData.clusters}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="percentage"
              >
                {clusterData.clusters.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="cluster-legend">
          {clusterData.clusters.map((cluster, _index) => (
            <div key={cluster.id} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: cluster.color }}
              ></div>
              <div className="legend-content">
                <div className="legend-name">{cluster.name}</div>
                <div className="legend-stats">
                  {cluster.size} days ({cluster.percentage}%)
                </div>
                {cluster.interpretation.length > 0 && (
                  <div className="legend-interpretation">
                    {cluster.interpretation.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Cluster Characteristics */}
      <div className="cluster-details">
        <h4>Cluster Characteristics</h4>
        <div className="cluster-cards">
          {clusterData.clusters.map((cluster, _index) => (
            <div key={cluster.id} className="cluster-card">
              <div className="cluster-header">
                <div 
                  className="cluster-indicator"
                  style={{ backgroundColor: cluster.color }}
                ></div>
                <div className="cluster-info">
                  <h5>{cluster.name}</h5>
                  <p>{cluster.size} days ({cluster.percentage}%)</p>
                </div>
              </div>

              <div className="cluster-characteristics">
                {Object.entries(cluster.characteristics).map(([metric, stats], _idx) => (
                  <div key={metric} className="characteristic-item">
                    <div className="characteristic-header">
                      <span className="metric-name">
                        {formatMetricName(metric)}
                      </span>
                      <span className="metric-value">
                        {stats.mean?.toFixed(1)}{getMetricUnit(metric)}
                      </span>
                    </div>
                    <div className="characteristic-details">
                      <span>Range: {stats.min?.toFixed(1)} - {stats.max?.toFixed(1)}</span>
                      <span>Std: ±{stats.std?.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {cluster.interpretation.length > 0 && (
                <div className="cluster-interpretation">
                  <h6>Pattern Description:</h6>
                  <ul>
                    {cluster.interpretation.map((desc, idx) => (
                      <li key={idx}>{desc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cluster Comparison Chart */}
      <div className="cluster-comparison">
        <h4>Cluster Comparison</h4>
        <div className="comparison-charts">
          {clusterData.featuresUsed.slice(0, 4).map((feature) => (
            <div key={feature} className="comparison-chart">
              <h5>{formatMetricName(feature)}</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={clusterData.clusters.map(cluster => ({
                    name: cluster.name,
                    value: cluster.characteristics[feature]?.mean || 0,
                    color: cluster.color
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value) => [`${value.toFixed(1)}${getMetricUnit(feature)}`, formatMetricName(feature)]}
                  />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>

  <style>{`
        .cluster-analysis {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .cluster-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #64748b;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 1rem;
          font-weight: 500;
        }

        .cluster-overview {
          background: #f8fafc;
          padding: 24px;
          border-radius: 12px;
        }

        .dark .cluster-overview {
          background: #334155;
        }

        .overview-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-item {
          text-align: center;
          padding: 16px;
          background: white;
          border-radius: 8px;
        }

        .dark .stat-item {
          background: #1e293b;
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

        .features-used h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin: 0 0 12px 0;
        }

        .dark .features-used h4 {
          color: #d1d5db;
        }

        .feature-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .feature-tag {
          background: #e0e7ff;
          color: #3730a3;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .dark .feature-tag {
          background: #1e3a8a;
          color: #a5b4fc;
        }

        .cluster-distribution {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: start;
        }

        .distribution-chart h4,
        .cluster-details h4,
        .cluster-comparison h4 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .dark .distribution-chart h4,
        .dark .cluster-details h4,
        .dark .cluster-comparison h4 {
          color: #f1f5f9;
        }

        .cluster-legend {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .legend-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .dark .legend-item {
          background: #334155;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .legend-content {
          flex: 1;
        }

        .legend-name {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .dark .legend-name {
          color: #f1f5f9;
        }

        .legend-stats {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 4px;
        }

        .dark .legend-stats {
          color: #94a3b8;
        }

        .legend-interpretation {
          font-size: 0.75rem;
          color: #6366f1;
          font-style: italic;
        }

        .dark .legend-interpretation {
          color: #a5b4fc;
        }

        .cluster-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .cluster-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          transition: box-shadow 0.2s ease;
        }

        .cluster-card:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .dark .cluster-card {
          background: #1e293b;
          border-color: #334155;
        }

        .cluster-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .cluster-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
        }

        .cluster-info h5 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 4px 0;
        }

        .dark .cluster-info h5 {
          color: #f1f5f9;
        }

        .cluster-info p {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
        }

        .dark .cluster-info p {
          color: #94a3b8;
        }

        .cluster-characteristics {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .characteristic-item {
          background: #f8fafc;
          padding: 12px;
          border-radius: 6px;
        }

        .dark .characteristic-item {
          background: #334155;
        }

        .characteristic-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .metric-name {
          font-weight: 500;
          color: #374151;
          font-size: 0.875rem;
        }

        .dark .metric-name {
          color: #d1d5db;
        }

        .metric-value {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.875rem;
        }

        .dark .metric-value {
          color: #f1f5f9;
        }

        .characteristic-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #64748b;
        }

        .dark .characteristic-details {
          color: #94a3b8;
        }

        .cluster-interpretation {
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
        }

        .dark .cluster-interpretation {
          border-top-color: #475569;
        }

        .cluster-interpretation h6 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin: 0 0 8px 0;
        }

        .dark .cluster-interpretation h6 {
          color: #d1d5db;
        }

        .cluster-interpretation ul {
          margin: 0;
          padding-left: 16px;
        }

        .cluster-interpretation li {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 4px;
        }

        .dark .cluster-interpretation li {
          color: #94a3b8;
        }

        .comparison-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
        }

        .comparison-chart h5 {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin: 0 0 12px 0;
          text-align: center;
        }

        .dark .comparison-chart h5 {
          color: #d1d5db;
        }

        /* tooltip styles unified in src/index.css */

        @media (max-width: 768px) {
          .cluster-distribution {
            grid-template-columns: 1fr;
          }

          .cluster-cards {
            grid-template-columns: 1fr;
          }

          .comparison-charts {
            grid-template-columns: 1fr;
          }

          .overview-stats {
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default ClusterAnalysis;