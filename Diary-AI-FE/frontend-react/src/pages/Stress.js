import React, { useEffect, useState } from 'react';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import HealthChart from '../components/HealthChart';
import MetricCard from '../components/MetricCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.map(p => {
    const name = p.name || p.dataKey || 'value';
    const val = p.value != null ? p.value : 'N/A';
    const color = p.color || p.fill || p.stroke || '#64748b';
    const isDuration = /duration|minutes|minute|min/i.test(String(name)) || (typeof val === 'string' && /\d+\s?min/i.test(val));
    return { name, val, color, isDuration };
  });

  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {rows.map((r, i) => (
        <p key={i} className="tooltip-value">
          <span className="tooltip-metric" style={{ color: r.color }}>{r.name}:</span>
          <span
            className="tooltip-number"
            style={{ color: r.isDuration ? '#ffffff' : undefined }}
          >
            {r.name === 'stress' ? `${r.val}/100` : r.val}
          </span>
        </p>
      ))}
    </div>
  );
};

const Stress = () => {
  const { 
    loading, 
    error, 
    fetchSpecializedAnalysis 
  } = useHealthData();

  const [stressData, setStressData] = useState(null);
  const [analysisParams, setAnalysisParams] = useState({
    days: 30
  });

  // Load saved stress analysis period from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stress_period_days');
      if (saved) {
        const parsed = parseInt(saved);
        if (!isNaN(parsed)) {
          setAnalysisParams(prev => ({ ...prev, days: parsed }));
        }
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);


  useEffect(() => {
    loadStressAnalysis();
  }, [analysisParams.days]);

  const loadStressAnalysis = async () => {
    const data = await fetchSpecializedAnalysis('stress', analysisParams.days);
    if (data) {
      setStressData(data);
    }
  };

  const handleRefresh = () => {
    loadStressAnalysis();
  };

  const handleParamsChange = (newParams) => {
    setAnalysisParams(prev => ({ ...prev, ...newParams }));
    try {
      if (newParams.days !== undefined) {
        localStorage.setItem('stress_period_days', String(newParams.days));
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  if (loading && !stressData) {
    return <LoadingSpinner message="Analyzing stress patterns..." />;
  }

  if (error && !stressData) {
    return <ErrorMessage message={error} onRetry={handleRefresh} />;
  }

  const stressAnalysis = stressData?.stress_analysis;
  const hourlyPatterns = stressAnalysis?.hourly_patterns;
  const dailyPatterns = stressAnalysis?.daily_patterns;
  const stressTriggers = stressAnalysis?.stress_triggers;
  const recoveryPatterns = stressAnalysis?.recovery_patterns;
  const recommendations = stressAnalysis?.stress_recommendations || [];

  // Process hourly patterns for chart
  const hourlyChartData = hourlyPatterns?.hourly_breakdown ? 
    Object.entries(hourlyPatterns.hourly_breakdown).map(([hour, data]) => ({
      hour: `${hour}:00`,
      stress: data.avg_stress != null ? Number(data.avg_stress) : null,
      episodes: data.stress_episodes,
      measurements: data.measurements
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)) : [];

  // Process daily patterns for chart (ensure Monday-first ordering)
  const dailyChartData = (() => {
    if (!dailyPatterns) return [];
    const weekOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    // helper to retrieve pattern by name or by numeric index (0=Sunday)
    const getPattern = (name) => {
      // direct name (case-insensitive)
      for (const k of Object.keys(dailyPatterns)) {
        if (String(k).toLowerCase() === String(name).toLowerCase()) return dailyPatterns[k];
      }
      // try numeric index: map Monday->1, ..., Sunday->0
      const nameToIdx = { 'sunday':0,'monday':1,'tuesday':2,'wednesday':3,'thursday':4,'friday':5,'saturday':6 };
      const idx = nameToIdx[String(name).toLowerCase()];
      if (idx !== undefined) {
        // keys might be numbers or strings
        if (dailyPatterns[idx] !== undefined) return dailyPatterns[idx];
        if (dailyPatterns[String(idx)] !== undefined) return dailyPatterns[String(idx)];
      }
      return null;
    };

    const out = [];
    for (const dayName of weekOrder) {
      const d = getPattern(dayName);
      out.push({
        day: dayName,
        stress: d?.avg_stress ?? null,
        episodes: d?.high_stress_episodes ?? 0,
        variability: d?.stress_variability ?? null
      });
    }
    return out;
  })();

  const getStressLevel = (stress) => {
    if (stress == null) return { level: 'N/A', color: '#94a3b8' };
    if (stress <= 25) return { level: 'Low', color: '#10b981' };
    if (stress <= 50) return { level: 'Moderate', color: '#f59e0b' };
    if (stress <= 75) return { level: 'High', color: '#f97316' };
    return { level: 'Very High', color: '#ef4444' };
  };

  // Heuristic, correlated recommendations derived from analysis signals
  const inferredRecommendations = [];
  const highEpisodes = stressTriggers?.total_high_stress_episodes || 0;
  const avgEpisodeDuration = stressTriggers?.avg_episode_duration || 0;
  const avgRecoveryReadings = recoveryPatterns?.avg_recovery_time_readings ?? null;
  const recoveryConsistency = recoveryPatterns?.recovery_consistency ?? null;
  const peakHour = hourlyPatterns?.peak_stress_hour;

  if (highEpisodes > 10) {
    inferredRecommendations.push({ text: `There are ${highEpisodes} high-stress episodes in the selected period — consider reducing workload peaks, delegating tasks, or adding buffer time between meetings.`, priority: 'High' });
  }

  if (avgEpisodeDuration > 6) {
    inferredRecommendations.push({ text: `Average high-stress episode lasts ${avgEpisodeDuration} measurements — introduce short breathing breaks (1–3 minutes) or micro-pauses every hour to shorten episodes.`, priority: 'High' });
  }

  if (avgRecoveryReadings != null && avgRecoveryReadings > 6) {
    inferredRecommendations.push({ text: `Average recovery takes ${avgRecoveryReadings} readings — try nightly wind-down routines and avoid stimulants late in the day to speed recovery.`, priority: 'Medium' });
  }

  if (recoveryConsistency != null && recoveryConsistency < 50) {
    inferredRecommendations.push({ text: `Recovery consistency is low (${recoveryConsistency}%) — build consistent post-stress recovery habits (short walks, breathing, hydration).`, priority: 'Medium' });
  }

  if (peakHour != null) {
    const ph = Number(peakHour);
    if (!Number.isNaN(ph)) {
      if (ph >= 20 || ph <= 4) {
        inferredRecommendations.push({ text: `Peak stress around ${peakHour}:00 — evening wind-down (screen curfew, relaxation) may improve sleep and recovery.`, priority: 'Medium' });
      } else {
        inferredRecommendations.push({ text: `Peak stress around ${peakHour}:00 — try scheduling focused work blocks and short breaks around this time.`, priority: 'Low' });
      }
    }
  }

  const worstDay = dailyChartData.reduce((acc, d) => (d.stress != null && (!acc || d.stress > acc.stress) ? d : acc), null);
  if (worstDay && worstDay.stress > 60) {
    inferredRecommendations.push({ text: `${worstDay.day} has elevated average stress (${worstDay.stress}/100) — review recurring tasks or commitments on that day.`, priority: 'Medium' });
  }

  const mergedRecommendations = [
    ...inferredRecommendations,
    ...((recommendations && recommendations.length) ? recommendations.map((r, i) => ({ text: r, priority: i === 0 ? 'High' : i === 1 ? 'Medium' : 'Low' })) : [])
  ];

  // Contextual guide notes derived from the same signals used for recommendations
  const guideNotes = { low: [], moderate: [], high: [], 'very-high': [] };
  if (recoveryConsistency != null && recoveryConsistency < 50) {
    guideNotes.moderate.push(`Recovery consistency is low (${recoveryConsistency}%) — try consistent post-stress routines.`);
    guideNotes.high.push(`Recovery consistency is low (${recoveryConsistency}%) — prioritize short recovery breaks and sleep hygiene.`);
  }
  if (avgRecoveryReadings != null && avgRecoveryReadings > 6) {
    guideNotes.high.push(`Average recovery time is ${avgRecoveryReadings} readings — consider evening wind-down and frequent micro-breaks to speed recovery.`);
    guideNotes['very-high'].push(`Slow recovery observed — consult stress-reduction practices and track evening routines.`);
  }
  if (highEpisodes > 12) {
    guideNotes.high.push(`Frequent high-stress episodes (${highEpisodes}) — workload adjustments and delegation can help.`);
    guideNotes['very-high'].push(`High episode count detected — consider a short term reduction in high-load tasks.`);
  }
  if (peakHour != null) {
    const ph = Number(peakHour);
    if (!Number.isNaN(ph) && (ph >= 20 || ph <= 4)) {
      guideNotes.moderate.push(`Peak stress in the evening (${peakHour}:00) — limit screens and stimulants before bed.`);
    }
  }

  return (
    <div className="stress-page fade-in">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <span className="title-icon">😰</span>
            Stress Analysis
          </h1>
          <p className="page-subtitle">
            Comprehensive analysis of your stress patterns, triggers, and recovery
          </p>
        </div>
        
        <div className="header-controls">
          <select
            value={analysisParams.days}
            onChange={(e) => handleParamsChange({ days: parseInt(e.target.value) })}
            className="period-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 2 weeks</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 2 months</option>
          </select>
          
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stress Overview */}
      {hourlyPatterns && (
        <div className="stress-overview">
          <h3>Stress Pattern Overview</h3>
          <div className="overview-metrics">
            <MetricCard
              title="Peak Stress Hour"
              value={hourlyPatterns.peak_stress_hour ? `${hourlyPatterns.peak_stress_hour}:00` : 'N/A'}
              icon="📈"
              color="red"
              subtitle={`${hourlyPatterns.peak_stress_value || 0}/100 stress level`}
            />
            <MetricCard
              title="Calmest Hour"
              value={hourlyPatterns.calmest_hour ? `${hourlyPatterns.calmest_hour}:00` : 'N/A'}
              icon="😌"
              color="green"
              subtitle={`${hourlyPatterns.lowest_stress_value || 0}/100 stress level`}
            />
            <MetricCard
              title="High Stress Episodes"
              value={stressTriggers?.total_high_stress_episodes || 0}
              icon="⚠️"
              color="orange"
              subtitle="Episodes above 75/100"
            />
            <MetricCard
              title="Recovery Time"
              value={recoveryPatterns?.avg_recovery_time_readings ? `${recoveryPatterns.avg_recovery_time_readings} readings` : 'N/A'}
              icon="⏱️"
              color="blue"
              subtitle="Average time to recover"
            />
          </div>
        </div>
      )}

      {/* Hourly Stress Patterns */}
      {hourlyChartData.length > 0 && (
        <div className="hourly-patterns">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Hourly Stress Patterns</h3>
              <p className="card-subtitle">Your stress levels throughout the day</p>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="stress" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    {hourlyChartData.map((d, i) => (
                      <Cell key={i} fill={getStressLevel(d.stress).color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {hourlyPatterns && (
              <div className="pattern-insights">
                <div className="insight-item">
                  <span className="insight-icon">📈</span>
                  <span>Peak stress typically occurs at {hourlyPatterns.peak_stress_hour}:00</span>
                </div>
                <div className="insight-item">
                  <span className="insight-icon">😌</span>
                  <span>You're most relaxed around {hourlyPatterns.calmest_hour}:00</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Stress Patterns */}
      {dailyChartData.length > 0 && (
        <div className="daily-patterns">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Day of Week Stress Patterns</h3>
              <p className="card-subtitle">How stress varies by day of the week</p>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="stress" fill="#ef4444" radius={[4, 4, 0, 0]}>
                    {dailyChartData.map((d, i) => (
                      <Cell key={i} fill={getStressLevel(d.stress).color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Stress Triggers Analysis */}
      {stressTriggers && (
        <div className="stress-triggers">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Stress Triggers & Episodes</h3>
              <p className="card-subtitle">Analysis of high stress periods and common trigger times</p>
            </div>
            <div className="triggers-content">
              <div className="triggers-stats">
                <div className="trigger-stat">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-content">
                    <div className="stat-value">{stressTriggers.total_high_stress_episodes}</div>
                    <div className="stat-label">High Stress Episodes</div>
                    <div className="stat-detail">Stress level above 75/100</div>
                  </div>
                </div>
                
                <div className="trigger-stat">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-content">
                    <div className="stat-value">{stressTriggers.avg_episode_duration}</div>
                    <div className="stat-label">Avg Episode Duration</div>
                    <div className="stat-detail">Measurements per episode</div>
                  </div>
                </div>
              </div>

              {stressTriggers.common_trigger_times && stressTriggers.common_trigger_times.length > 0 && (
                <div className="trigger-times">
                  <h4>Common Trigger Times</h4>
                  <div className="trigger-times-list">
                    {stressTriggers.common_trigger_times.map((trigger, index) => (
                      <div key={index} className="trigger-time-item">
                        <div className="trigger-hour">{trigger.hour}:00</div>
                        <div className="trigger-frequency">{trigger.frequency} episodes</div>
                        <div className="trigger-bar">
                          <div 
                            className="trigger-fill"
                            style={{ width: `${(trigger.frequency / stressTriggers.common_trigger_times[0].frequency) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recovery Patterns */}
      {recoveryPatterns && (
        <div className="recovery-patterns">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Stress Recovery Analysis</h3>
              <p className="card-subtitle">How quickly you recover from high stress periods</p>
            </div>
            <div className="recovery-content">
              {(() => {
                const fast = recoveryPatterns.fast_recovery_episodes || 0;
                const slow = recoveryPatterns.slow_recovery_episodes || 0;
                const total = fast + slow;
                const pctFast = total ? Math.round((fast / total) * 100) : null;
                const pctSlow = total ? Math.round((slow / total) * 100) : null;
                const avgReadings = recoveryPatterns.avg_recovery_time_readings ?? null;
                const consistency = recoveryPatterns.recovery_consistency ?? null;
                const highStressCount = stressTriggers?.total_high_stress_episodes || 0;
                const burden = total ? Math.round((highStressCount / total) * 10) / 10 : null;

                return (
                  <>
                    <div className="recovery-stats">
                      <div className="recovery-stat">
                        <div className="stat-icon">⚡</div>
                        <div className="stat-content">
                          <div className="stat-value">{fast}</div>
                          <div className="stat-label">Fast Recovery</div>
                          <div className="stat-detail">≤ 4 measurements to recover</div>
                        </div>
                      </div>

                      <div className="recovery-stat">
                        <div className="stat-icon">🐌</div>
                        <div className="stat-content">
                          <div className="stat-value">{slow}</div>
                          <div className="stat-label">Slow Recovery</div>
                          <div className="stat-detail">Longer recovery episodes</div>
                        </div>
                      </div>

                      <div className="recovery-stat">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                          <div className="stat-value">{consistency != null ? `${consistency}%` : 'N/A'}</div>
                          <div className="stat-label">Recovery Consistency</div>
                          <div className="stat-detail">How stable recovery responses are</div>
                        </div>
                      </div>
                    </div>

                    <div style={{display:'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap'}}>
                      <div className="zone" style={{flex:1, minWidth: 160}}>
                        <div className="zone-range">{pctFast != null ? `${pctFast}%` : 'N/A'}</div>
                        <div className="zone-label">% Fast Recovery</div>
                        <div className="zone-description">Share of recovery episodes that were fast (≤4 readings)</div>
                      </div>
                      <div className="zone" style={{flex:1, minWidth: 160}}>
                        <div className="zone-range">{pctSlow != null ? `${pctSlow}%` : 'N/A'}</div>
                        <div className="zone-label">% Slow Recovery</div>
                        <div className="zone-description">Share of slow recovery episodes</div>
                      </div>
                      <div className="zone" style={{flex:1, minWidth: 180}}>
                        <div className="zone-range">{avgReadings != null ? `${avgReadings} readings` : 'N/A'}</div>
                        <div className="zone-label">Avg recovery time (readings)</div>
                        <div className="zone-description">Smaller = faster recovery</div>
                      </div>
                      <div className="zone" style={{flex:1, minWidth: 180}}>
                        <div className="zone-range">{burden != null ? `${burden}` : 'N/A'}</div>
                        <div className="zone-label">High stress per recovery episode</div>
                        <div className="zone-description">Higher values indicate more stress events relative to recovery capacity</div>
                      </div>
                    </div>

                    <div className="recovery-insights" style={{marginTop: '12px'}}>
                      <h4>Recovery Insights</h4>
                      <div className="insight-list">
                        {pctFast != null && pctFast >= 60 && (
                          <div className="insight-item success">
                            <span className="insight-icon">✅</span>
                            <span>Most episodes resolve quickly — good resilience.</span>
                          </div>
                        )}

                        {pctFast != null && pctFast < 40 && (
                          <div className="insight-item warning">
                            <span className="insight-icon">⚠️</span>
                            <span>Many slow recoveries — consider stress-reduction strategies (breathing, breaks, sleep hygiene).</span>
                          </div>
                        )}

                        {consistency != null && consistency < 50 && (
                          <div className="insight-item warning">
                            <span className="insight-icon">⚠️</span>
                            <span>Recovery is inconsistent — try regular recovery routines after high-stress events.</span>
                          </div>
                        )}

                        {burden != null && burden > 2 && (
                          <div className="insight-item warning">
                            <span className="insight-icon">⚠️</span>
                            <span>High rate of stress events relative to recovery episodes — workload or sleep may be impacting resilience.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Stress Recommendations */}
      {mergedRecommendations.length > 0 && (
        <div className="stress-recommendations">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Stress Management Recommendations</h3>
              <p className="card-subtitle">Personalized suggestions to better manage your stress</p>
            </div>
            <div className="recommendations-list">
              {mergedRecommendations.map((rec, index) => (
                <div key={index} className="recommendation-item">
                  <div className="recommendation-icon">💡</div>
                  <div className="recommendation-content">
                    <div className="recommendation-text">{rec.text}</div>
                    <div className="recommendation-priority">
                      Priority: {rec.priority || (index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stress Level Guide */}
      <div className="stress-guide">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Stress Level Guide</h3>
            <p className="card-subtitle">Understanding your stress measurements</p>
          </div>
          <div className="guide-content">
            <div className="stress-level low">
              <div className="level-range">0-25</div>
              <div className="level-label">Low Stress</div>
              <div className="level-description">
                Relaxed state. Your body is in recovery mode and stress hormones are low.
              </div>
              {guideNotes.low.length > 0 && (
                <ul className="level-notes">
                  {guideNotes.low.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
            <div className="stress-level moderate">
              <div className="level-range">26-50</div>
              <div className="level-label">Moderate Stress</div>
              <div className="level-description">
                Normal daily stress. Your body is handling typical life demands well.
              </div>
              {guideNotes.moderate.length > 0 && (
                <ul className="level-notes">
                  {guideNotes.moderate.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
            <div className="stress-level high">
              <div className="level-range">51-75</div>
              <div className="level-label">High Stress</div>
              <div className="level-description">
                Elevated stress. Consider stress management techniques and relaxation.
              </div>
              {guideNotes.high.length > 0 && (
                <ul className="level-notes">
                  {guideNotes.high.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
            <div className="stress-level very-high">
              <div className="level-range">76-100</div>
              <div className="level-label">Very High Stress</div>
              <div className="level-description">
                Significant stress. Take immediate steps to reduce stress and practice relaxation.
              </div>
              {guideNotes['very-high'].length > 0 && (
                <ul className="level-notes">
                  {guideNotes['very-high'].map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.custom-tooltip) {
+          /* glassmorphism */
+          background: var(--glass-bg);
+          backdrop-filter: blur(10px);
+          -webkit-backdrop-filter: blur(10px);
+          border: 1px solid var(--glass-border);
+          box-shadow: var(--glass-shadow);
+          padding: 10px 12px;
+          border-radius: 10px;
+          min-width: 140px;
+        }
+
+        :global(.tooltip-label) {
+          margin: 0 0 8px 0;
+          font-weight: 600;
+          color: #0f172a;
+        }
+        :global(.dark .tooltip-label) {
+          color: #f1f5f9;
+        }
+
+        :global(.tooltip-value) {
+          margin: 0 0 4px 0;
+          display: flex;
+          justify-content: space-between;
+          gap: 12px;
+        }
+
+        :global(.tooltip-metric) {
+          color: #64748b;
+        }
+        :global(.dark .tooltip-metric) {
+          color: #94a3b8;
+        }

+        :global(.tooltip-number) {
+          font-weight: 600;
+          color: #ef4444;
+        }
+
+        :global(.tooltip-extra) {
+          margin-top: 6px;
+          font-size: 0.85rem;
+          color: #64748b;
+        }

+        :global(.dark .tooltip-extra) {
+          color: #94a3b8;
+        }

        .stress-page {
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

        .stress-overview {
          margin-bottom: 32px;
        }

        .stress-overview h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .dark .stress-overview h3 {
          color: #f1f5f9;
        }

        .overview-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .hourly-patterns,
        .daily-patterns,
        .stress-triggers,
        .recovery-patterns,
        .stress-recommendations,
        .stress-guide {
          margin-bottom: 32px;
        }

        .chart-container {
          padding: 24px;
        }

        .pattern-insights {
          padding: 0 24px 24px;
          border-top: 1px solid #e2e8f0;
        }

        .dark .pattern-insights {
          border-top-color: #334155;
        }

        .insight-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          font-size: 0.875rem;
          color: #374151;
        }

        .dark .insight-item {
          color: #d1d5db;
        }

        .insight-icon {
          font-size: 1rem;
        }

        .triggers-content,
        .recovery-content {
          padding: 24px;
        }

        .triggers-stats,
        .recovery-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }

        .trigger-stat,
        .recovery-stat {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .dark .trigger-stat,
        .dark .recovery-stat {
          background: #334155;
        }

        .stat-icon {
          font-size: 2rem;
        }

        .stat-content {
          flex: 1;
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
          font-weight: 500;
          color: #374151;
          margin-bottom: 2px;
        }

        .dark .stat-label {
          color: #d1d5db;
        }

        .stat-detail {
          font-size: 0.75rem;
          color: #64748b;
        }

        .dark .stat-detail {
          color: #94a3b8;
        }

        .trigger-times h4,
        .recovery-insights h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin: 0 0 16px 0;
        }

        .dark .trigger-times h4,
        .dark .recovery-insights h4 {
          color: #d1d5db;
        }

        .trigger-times-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .trigger-time-item {
          display: grid;
          grid-template-columns: auto auto 1fr;
          gap: 16px;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .dark .trigger-time-item {
          background: #475569;
        }

        .trigger-hour {
          font-weight: 600;
          color: #1e293b;
        }

        .dark .trigger-hour {
          color: #f1f5f9;
        }

        .trigger-frequency {
          font-size: 0.875rem;
          color: #64748b;
        }

        .dark .trigger-frequency {
          color: #94a3b8;
        }

        .trigger-bar {
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .dark .trigger-bar {
          background: #64748b;
        }

        .trigger-fill {
          height: 100%;
          background: #ef4444;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .insight-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .insight-item.success {
          color: #166534;
        }

        .insight-item.warning {
          color: #92400e;
        }

        .dark .insight-item.success {
          color: #bbf7d0;
        }

        .dark .insight-item.warning {
          color: #fbbf24;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
        }

        .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          border-radius: 0 12px 12px 0;
        }

        .dark .recommendation-item {
          background: #451a03;
          border-left-color: #fbbf24;
        }

        .recommendation-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .recommendation-content {
          flex: 1;
        }

        .recommendation-text {
          color: #1e293b;
          font-size: 0.875rem;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .dark .recommendation-text {
          color: #f1f5f9;
        }

        .recommendation-priority {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        .dark .recommendation-priority {
          color: #94a3b8;
        }

        .guide-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 24px;
        }

        .stress-level {
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid;
        }

        .stress-level.low {
          background: #f0fdf4;
          border-left-color: #10b981;
        }

        .stress-level.moderate {
          background: #fffbeb;
          border-left-color: #f59e0b;
        }

        .stress-level.high {
          background: #fff7ed;
          border-left-color: #f97316;
        }

        .stress-level.very-high {
          background: #fef2f2;
          border-left-color: #ef4444;
        }

        .dark .stress-level.low {
          background: #14532d;
        }

        .dark .stress-level.moderate {
          background: #451a03;
        }

        .dark .stress-level.high {
          background: #431407;
        }

        .dark .stress-level.very-high {
          background: #7f1d1d;
        }

        .level-range {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .dark .level-range {
          color: #f1f5f9;
        }

        .level-label {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .dark .level-label {
          color: #d1d5db;
        }

        .level-description {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.5;
        }

        .dark .level-description {
          color: #94a3b8;
        }

        .level-notes {
          margin-top: 8px;
          padding-left: 18px;
          color: #475569;
          font-size: 0.875rem;
        }

        .level-notes li {
          margin-bottom: 6px;
        }

        .dark .level-notes {
          color: #cbd5e1;
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

          .overview-metrics {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .triggers-stats,
          .recovery-stats {
            grid-template-columns: 1fr;
          }

          .guide-content {
            grid-template-columns: 1fr;
          }

          .trigger-time-item {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default Stress;