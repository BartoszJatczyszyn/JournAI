import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui';
import { API_BASE_URL } from '../services';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import HealthChart from '../components/HealthChart';
import MetricCard from '../components/MetricCard';

// Local formatting helpers (avoid repeated 'N/A')
const formatNumber = (val, digits = 3) => {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(digits);
};

const safeText = (val) => (val && typeof val === 'string' ? val : (val ? String(val) : '—'));

const Predictions = () => {
  const {
    predictions,
    loading,
    error,
    fetchPredictions,
  } = useHealthData();

  const [selectedPrediction, setSelectedPrediction] = useState('energy');
  const [daysAhead, setDaysAhead] = useState(() => {
    try {
      const saved = localStorage.getItem('predictions_daysAhead');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isNaN(parsed) ? 7 : parsed;
    } catch (e) {
      // ignore localStorage errors
      return 7;
    }
  });

  useEffect(() => {
    if (!predictions) {
      fetchPredictions(daysAhead);
    }
  }, [predictions, fetchPredictions, daysAhead]);

  const handleRefresh = () => {
    fetchPredictions(daysAhead);
  };

  const handleRetrain = async () => {
    try {
      await fetch(`${API_BASE_URL || ''}/api/admin/models/retrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      });
      fetchPredictions(daysAhead);
    } catch (e) {
      console.error('Retrain failed', e);
    }
  };

  const handleDaysChange = (newDays) => {
    setDaysAhead(newDays);
  try { localStorage.setItem('predictions_daysAhead', String(newDays)); } catch (e) { /* ignore */ }
    fetchPredictions(newDays);
  };

  if (loading && !predictions) {
    return <LoadingSpinner message="Generating AI predictions..." />;
  }

  if (error && !predictions) {
    return <ErrorMessage message={error} onRetry={handleRefresh} />;
  }

  const predictionTypes = [
    { id: 'energy', label: 'Energy Predictions', icon: '⚡', description: 'AI-powered energy level forecasts', color: 'blue' },
    { id: 'sleep', label: 'Sleep Predictions', icon: '😴', description: 'Sleep quality predictions', color: 'purple' },
    { id: 'mood', label: 'Mood Predictions', icon: '🎭', description: 'Mood trend forecasts', color: 'yellow' },
    { id: 'comprehensive', label: 'Comprehensive', icon: '🔮', description: 'All predictions combined', color: 'green' },
  ];

  const getCurrentPredictionData = () => {
    if (!predictions) return null;
    switch (selectedPrediction) {
      case 'energy': return predictions.energy;
      case 'sleep': return predictions.sleep;
      case 'mood': return predictions.mood;
      case 'comprehensive': return predictions.comprehensive;
      default: return null;
    }
  };

  const currentData = getCurrentPredictionData();

  const extractPredictionsInfo = (data) => {
    if (!data) return { list: [], model: null, confidenceLevel: null, status: data?.status, message: data?.message };
    // Case 1: { predictions: [...] }
    if (Array.isArray(data.predictions)) {
      return { list: data.predictions || [], model: data.model_performance || null, confidenceLevel: data.confidence_level || null, status: data.status, message: data.message };
    }
    // Case 2: { predictions: { predictions: [...] } }
    if (data.predictions?.predictions && Array.isArray(data.predictions.predictions)) {
      return { list: data.predictions.predictions, model: data.predictions.model_performance || data.model_performance || null, confidenceLevel: data.predictions.confidence_level || data.confidence_level || null, status: data.status, message: data.message };
    }
    // Case 3: comprehensive shape
    if (data.predictions?.energy_predictions?.predictions) {
      const ep = data.predictions.energy_predictions;
      return { list: ep.predictions || [], model: ep.model_performance || null, confidenceLevel: ep.confidence_level || null, status: data.status, message: data.message };
    }
    return { list: [], model: null, confidenceLevel: null, status: data.status, message: data.message };
  };

  const formatPredictionData = (predictionData) => {
    const { list } = extractPredictionsInfo(predictionData);
    if (!Array.isArray(list)) return [];
    return list.map((pred) => ({
      day: pred.date,
      date: pred.date,
      value: pred.predicted_value,
      confidence: pred.confidence,
    }));
  };

  const getConfidenceColor = (confidence) => (confidence >= 0.8 ? '#10b981' : confidence >= 0.6 ? '#f59e0b' : '#ef4444');
  const getConfidenceLabel = (confidence) => (confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low');

  const info = extractPredictionsInfo(currentData || {});
  const list = formatPredictionData(currentData);

  // Compute additional meaningful forecast stats for display when model metrics are sparse
  const forecastStats = (() => {
    if (!list || list.length === 0) return null;
    const values = list.map(p => (typeof p.value === 'number' ? p.value : Number(p.value))).filter(v => Number.isFinite(v));
    if (!values.length) return null;
    const avg = values.reduce((a,b)=>a+b,0) / values.length;
    const first = values[0];
    const last = values[values.length - 1];
    const deltaAbs = last - first;
    const deltaPct = first !== 0 ? (deltaAbs / first) * 100 : null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.length > 1 ? values.reduce((a,b)=>a + Math.pow(b - avg,2),0)/(values.length -1) : 0;
    const stdDev = Math.sqrt(variance);
    // Classify mini trend direction
    let trendDirection = 'Stable';
    if (deltaPct !== null) {
      if (deltaPct > 5) trendDirection = 'Upward';
      else if (deltaPct < -5) trendDirection = 'Downward';
    }
    const expectedLow = avg - stdDev;
    const expectedHigh = avg + stdDev;
    return { avg, first, last, deltaAbs, deltaPct, min, max, stdDev, trendDirection, expectedLow, expectedHigh };
  })();

  return (
    <div className="predictions-page fade-in">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title"><span className="title-icon">🔮</span>AI Predictions</h1>
          <p className="page-subtitle">Machine learning-powered forecasts for your health metrics</p>
        </div>
        <div className="header-controls">
          <select value={daysAhead} onChange={(e) => handleDaysChange(parseInt(e.target.value, 10))} className="days-select">
            <option value={3}>3 days ahead</option>
            <option value={7}>7 days ahead</option>
            <option value={14}>14 days ahead</option>
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleRefresh} disabled={loading} variant="primary">
              {loading ? (<><div className="loading-spinner"></div>Predicting...</>) : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh Predictions</>)}
              </Button>
              <Button onClick={handleRetrain} disabled={loading} variant="ghost" title="Retrain predictive models">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.29 3.86l-1.5 1.5A7.5 7.5 0 1012 19.5" /></svg>
              Retrain Models
            </Button>
          </div>
        </div>
      </div>

      {/* Prediction Type Selector */}
      <div className="prediction-types">
        {predictionTypes.map((type) => (
          <button key={type.id} className={`prediction-type ${selectedPrediction === type.id ? 'active' : ''}`} onClick={() => setSelectedPrediction(type.id)}>
            <span className="type-icon">{type.icon}</span>
            <div className="type-content">
              <div className="type-label">{type.label}</div>
              <div className="type-description">{type.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Current Prediction Display */}
      {currentData && (
        <div className="prediction-content">
          {/* Model Performance */}
          {(info.model || forecastStats) && (
            <div className="model-performance">
              <h3>Model & Forecast Summary</h3>
              <div className="performance-metrics">
                {/* Model metrics (if available) */}
                {info?.model?.r2_score != null && <MetricCard title="R² Score" value={formatNumber(info.model.r2_score, 3)} icon="📊" subtitle="Model accuracy" color="blue" />}
                {info?.model?.rmse != null && <MetricCard title="RMSE" value={formatNumber(info.model.rmse, 3)} icon="📏" subtitle="Prediction error" color="orange" />}
                {safeText(info?.model?.model_used) !== '—' && <MetricCard title="Model Type" value={safeText(info.model.model_used)} icon="🤖" subtitle="Algorithm used" color="purple" />}
                {info.confidenceLevel && <MetricCard title="Confidence" value={safeText(info.confidenceLevel)} icon="🎯" subtitle="Prediction confidence" color="green" />}

                {/* Forecast-derived metrics */}
                {forecastStats && <MetricCard title="Avg Forecast" value={formatNumber(forecastStats.avg, 2)} icon="📈" subtitle="Average predicted value" color="teal" />}
                {forecastStats && forecastStats.deltaAbs !== 0 && <MetricCard title="Change" value={`${forecastStats.deltaAbs>0?'+':''}${formatNumber(forecastStats.deltaAbs,2)}`} icon={forecastStats.deltaAbs>=0?'⬆️':'⬇️'} subtitle="Last - First" color={forecastStats.deltaAbs>=0?'green':'red'} />}
                {forecastStats && forecastStats.deltaPct !== null && <MetricCard title="Change %" value={`${forecastStats.deltaAbs>=0?'+':''}${formatNumber(forecastStats.deltaPct,1)}%`} icon="%" subtitle="Relative change" color={forecastStats.deltaAbs>=0?'green':'red'} />}
                {forecastStats && <MetricCard title="Range" value={`${formatNumber(forecastStats.min,1)}–${formatNumber(forecastStats.max,1)}`} icon="📏" subtitle="Min–Max" color="orange" />}
                {forecastStats && forecastStats.stdDev > 0 && <MetricCard title="Volatility" value={formatNumber(forecastStats.stdDev,2)} icon="🌪️" subtitle="Std Dev" color="yellow" />}
                {forecastStats && <MetricCard title="Trend" value={forecastStats.trendDirection} icon={forecastStats.trendDirection==='Upward'?'📈':forecastStats.trendDirection==='Downward'?'📉':'➡️'} subtitle="Mini trend" color={forecastStats.trendDirection==='Upward'?'green':forecastStats.trendDirection==='Downward'?'red':'blue'} />}
                {forecastStats && forecastStats.stdDev > 0 && <MetricCard title="Expected Band" value={`${formatNumber(forecastStats.expectedLow,1)}–${formatNumber(forecastStats.expectedHigh,1)}`} icon="🛡️" subtitle="Avg ± 1σ" color="purple" />}
              </div>
              {(!info?.model?.r2_score && !info?.model?.rmse && !info?.model?.model_used) && (
                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 8 }}>No model metrics available – showing forecast statistics (average, change, range, volatility, trend, expected band).</div>
              )}
            </div>
          )}

          {/* Predictions Chart */}
          <div className="predictions-chart">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{predictionTypes.find((t) => t.id === selectedPrediction)?.label} Forecast</h3>
                <p className="card-subtitle">{daysAhead}-day predictions with confidence intervals</p>
                {info.status === 'partial' && (<span className="badge badge-warning">Limited data</span>)}
                {info.status === 'error' && (<span className="badge badge-error">Unavailable</span>)}
              </div>
              {list.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  {/* Expected band overlay (simple SVG) */}
                  {forecastStats && forecastStats.stdDev > 0 && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {/* We'll render a translucent band using absolute positioned element; real integration would enhance HealthChart component itself */}
                      <div style={{ position:'absolute', left:0, right:0, top:0, bottom:0 }}>
                        {/* Since HealthChart is opaque to us, we provide a legend-like badge */}
                        <div style={{ position:'absolute', top:8, right:8, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.4)', padding:'2px 6px', borderRadius:4, fontSize:'0.6rem', backdropFilter:'blur(2px)' }}>Expected band (±1σ)</div>
                      </div>
                    </div>
                  )}
                  <HealthChart data={list} metric="value" height={350} type="line" />
                </div>
              ) : (
                <div className="no-data" style={{ padding: '1rem', color: 'var(--muted)' }}>No prediction points available for the selected period.</div>
              )}
            </div>
          </div>

          {/* Predictions Table */}
          {list.length > 0 && (
            <div className="predictions-table">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Detailed Predictions</h3>
                  {info.status === 'partial' && (<span className="badge badge-warning">Limited data</span>)}
                  {info.status === 'error' && (<span className="badge badge-error">Unavailable {info.message ? `- ${info.message}` : ''}</span>)}
                </div>
                <div className="table-container">
                  <table className="predictions-data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Predicted Value</th>
                        <th>Confidence</th>
                        <th>Confidence Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((pred, index) => (
                        <tr key={index}>
                          <td>{new Date(pred.date).toLocaleDateString()}</td>
                          <td className="predicted-value">{Number(pred.value).toFixed(2)}</td>
                          <td>
                            <div className="confidence-bar">
                              <div className="confidence-fill" style={{ width: `${pred.confidence * 100}%`, backgroundColor: getConfidenceColor(pred.confidence) }} />
                            </div>
                          </td>
                          <td><span className="confidence-label" style={{ color: getConfidenceColor(pred.confidence) }}>{getConfidenceLabel(pred.confidence)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Feature Importance */}
          {Array.isArray(currentData?.predictions?.feature_importance) && currentData.predictions.feature_importance.length > 0 && (
            <div className="feature-importance">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Key Factors</h3>
                  <p className="card-subtitle">Most important factors influencing predictions</p>
                </div>
                <div className="importance-list">
                  {currentData.predictions.feature_importance
                    .slice()
                    .sort((a, b) => b.importance - a.importance)
                    .slice(0, 5)
                    .map((factor, index) => (
                      <div key={index} className="importance-item">
                        <div className="factor-name">{factor.feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</div>
                        <div className="importance-bar">
                          <div className="importance-fill" style={{ width: `${(factor.importance / currentData.predictions.feature_importance[0].importance) * 100}%` }} />
                        </div>
                        <div className="importance-value">{(factor.importance * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Health Trends Overview */}
      {predictions?.trends && predictions.trends.status === 'success' && (
        <div className="health-trends">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Overall Health Trends</h3>
              <p className="card-subtitle">Long-term health direction analysis</p>
            </div>
            <div className="trends-content">
              <div className="trend-direction">
                <div className="trend-icon">
                  {predictions.trends.overall_health_direction === 'improving' ? '📈' : predictions.trends.overall_health_direction === 'declining' ? '📉' : '➡️'}
                </div>
                <div className="trend-text">
                  <div className="trend-label">Health Direction</div>
                  <div className="trend-value">{(predictions.trends.overall_health_direction?.charAt(0).toUpperCase() + predictions.trends.overall_health_direction?.slice(1)) || 'Stable'}</div>
                </div>
              </div>
              {predictions.trends.metrics && (
                <div className="trend-metrics" style={{ marginTop: '20px', display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                  {Object.entries(predictions.trends.metrics).map(([key, m]) => {
                    if (!m) return null;
                    const pct = typeof m.pct_change === 'number' ? (m.pct_change * 100).toFixed(1) : '—';
                    const conf = m.confidence != null ? Math.round(m.confidence * 100) : null;
                    const directionEmoji = m.direction === 'improving' ? '📈' : m.direction === 'declining' ? '📉' : '➡️';
                    const spark = Array.isArray(m.sparkline) ? m.sparkline.slice() : [];
                    const hasSpark = spark.length > 1;
                    let norm = spark;
                    let minV = 0, maxV = 1;
                    if (hasSpark) {
                      minV = Math.min(...spark);
                      maxV = Math.max(...spark);
                      const range = maxV - minV || 1;
                      norm = spark.map(v => (v - minV) / range);
                    }
                    // Direction-based colors
                    let strokeColor = '#3b82f6';
                    if (m.direction === 'improving') strokeColor = '#059669';
                    else if (m.direction === 'declining') strokeColor = '#dc2626';
                    const fillGradientTop = m.direction === 'improving' ? '#10b981' : m.direction === 'declining' ? '#f87171' : '#64748b';
                    const fillGradientBottom = m.direction === 'improving' ? '#10b981' : m.direction === 'declining' ? '#f87171' : '#64748b';
                    return (
                      <div key={key} className="trend-metric" style={{ padding: '16px 14px 14px', background: 'var(--card-bg, rgba(0,0,0,0.035))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: 12, position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600, opacity: 0.75 }}>{key.replace(/_/g,' ')}</div>
                          {conf !== null && <div style={{ fontSize: '0.55rem', background: 'rgba(0,0,0,0.12)', padding: '2px 6px', borderRadius: 10, opacity: 0.65 }}>{conf}%</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{directionEmoji}<span>{m.direction}</span></div>
                          <div style={{ fontSize: '0.6rem', opacity: 0.55 }}>Δ {pct}%</div>
                        </div>
                        {hasSpark && (
                          <div style={{ position: 'relative', width: '100%', height: 60, marginTop: 2 }}>
                            <svg viewBox={`0 0 ${norm.length - 1} 1`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                              <defs>
                                <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={fillGradientTop} stopOpacity="0.45" />
                                  <stop offset="95%" stopColor={fillGradientBottom} stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <title>{`${key.replace(/_/g,' ')} trend (Δ ${pct}%)`}</title>
                              <polyline
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={0.08}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                points={norm.map((v,i)=>`${i},${1 - v}`).join(' ')}
                                style={{ filter:'drop-shadow(0 0 0.4px rgba(0,0,0,0.4))' }}
                              />
                              <polygon
                                fill={`url(#grad-${key})`}
                                opacity={0.5}
                                points={`${norm.map((v,i)=>`${i},${1 - v}`).join(' ')} ${norm.length -1},1 0,1`}
                              />
                              <circle r={0.14} cx={norm.length -1} cy={1 - norm[norm.length -1]} fill={strokeColor} stroke="#111827" strokeWidth={0.04} />
                              {norm.map((v,i)=> {
                                const originalVal = ((v * (maxV - minV)) + minV).toFixed(2);
                                return (
                                  <g key={i}>
                                    {/* Visible tiny marker (optional remove) */}
                                    <circle r={0.02} cx={i} cy={1 - v} fill="transparent" />
                                    {/* Enlarged invisible hover target with title for tooltip */}
                                    <circle r={0.32} cx={i} cy={1 - v} fill="transparent" stroke="transparent">
                                      <title>{`${key.replace(/_/g,' ')} | Point ${i + 1}\nValue: ${originalVal}`}</title>
                                    </circle>
                                  </g>
                                );
                              })}
                            </svg>
                            <div style={{ position:'absolute', bottom:2, left:0, fontSize:'0.5rem', opacity:0.55 }}>{minV.toFixed(1)}</div>
                            <div style={{ position:'absolute', top:0, right:0, fontSize:'0.5rem', opacity:0.55 }}>{maxV.toFixed(1)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {predictions?.trends && predictions.trends.status !== 'success' && (
        <div className="health-trends">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Overall Health Trends</h3>
              <p className="card-subtitle">Long-term health direction analysis</p>
            </div>
            <div style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Health trends unavailable: {predictions.trends.message || 'Endpoint error'}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .predictions-page { max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .dark .page-header { border-bottom-color: #334155; }
        .header-content { flex: 1; }
        .page-title { display: flex; align-items: center; gap: 12px; font-size: 2rem; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; }
        .dark .page-title { color: #f1f5f9; }
        .title-icon { font-size: 2.5rem; }
        .page-subtitle { color: #64748b; margin: 0; font-size: 1rem; }
        .dark .page-subtitle { color: #94a3b8; }
        .header-controls { display: flex; gap: 12px; align-items: center; }
        .days-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; color: #1e293b; font-size: 0.875rem; }
        .dark .days-select { background: #334155; border-color: #475569; color: #f1f5f9; }
        .prediction-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .prediction-type { display: flex; align-items: center; gap: 12px; padding: 20px; background: white; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; text-align: left; }
        .prediction-type:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .prediction-type.active { border-color: #3b82f6; background: #eff6ff; }
        .dark .prediction-type { background: #1e293b; border-color: #334155; }
        .dark .prediction-type:hover { border-color: #475569; }
        .dark .prediction-type.active { border-color: #60a5fa; background: #1e3a8a; }
        .type-icon { font-size: 1.5rem; }
        .type-content { flex: 1; }
        .type-label { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
        .dark .type-label { color: #f1f5f9; }
        .type-description { font-size: 0.875rem; color: #64748b; }
        .dark .type-description { color: #94a3b8; }
        .prediction-content { display: flex; flex-direction: column; gap: 32px; }
        .model-performance h3 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; }
        .dark .model-performance h3 { color: #f1f5f9; }
        .performance-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .predictions-data-table { width: 100%; border-collapse: collapse; }
        .predictions-data-table th, .predictions-data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .dark .predictions-data-table th, .dark .predictions-data-table td { border-bottom-color: #334155; }
        .predictions-data-table th { background: #f8fafc; font-weight: 600; color: #374151; font-size: 0.875rem; }
        .dark .predictions-data-table th { background: #334155; color: #d1d5db; }
        .predictions-data-table td { color: #1e293b; font-size: 0.875rem; }
        .dark .predictions-data-table td { color: #f1f5f9; }
        .predicted-value { font-weight: 600; font-family: 'Monaco', 'Menlo', monospace; }
        .confidence-bar { width: 100px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .dark .confidence-bar { background: #475569; }
        .confidence-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .confidence-label { font-weight: 500; font-size: 0.75rem; }
        .importance-list { display: flex; flex-direction: column; gap: 16px; }
        .importance-item { display: grid; grid-template-columns: 1fr 200px auto; gap: 16px; align-items: center; }
        .factor-name { font-weight: 500; color: #374151; }
        .dark .factor-name { color: #d1d5db; }
        .importance-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .dark .importance-bar { background: #475569; }
        .importance-fill { height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.3s ease; }
        .importance-value { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
        .dark .importance-value { color: #f1f5f9; }
        .trends-content { padding: 24px; }
        .trend-direction { display: flex; align-items: center; gap: 16px; }
        .trend-icon { font-size: 2rem; }
        .trend-label { font-size: 0.875rem; color: #64748b; margin-bottom: 4px; }
        .dark .trend-label { color: #94a3b8; }
        .trend-value { font-size: 1.25rem; font-weight: 600; color: #1e293b; }
        .dark .trend-value { color: #f1f5f9; }
        .loading-spinner { width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px; }
        .badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-error { background: #fee2e2; color: #991b1b; }
        .w-4 { width: 1rem; }
        .h-4 { height: 1rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .page-header { flex-direction: column; gap: 16px; }
          .prediction-types { grid-template-columns: 1fr; }
          .performance-metrics { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
          .importance-item { grid-template-columns: 1fr; gap: 8px; }
        }
      `}</style>
    </div>
  );
};

export default Predictions;
