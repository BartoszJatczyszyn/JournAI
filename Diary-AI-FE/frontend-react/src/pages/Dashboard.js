import React, { useEffect, useState } from 'react';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import MetricsGrid from '../components/dashboard/MetricsGrid';
import HealthTrendsCard from '../components/dashboard/HealthTrendsCard';
// CorrelationSection is not currently used in this file
// import CorrelationSection from '../components/dashboard/CorrelationSection';
import CorrelationMatrix from '../components/CorrelationMatrix';
import { lowerIsBetterNote } from '../utils/metricUtils';
import DataOverviewCard from '../components/dashboard/DataOverviewCard';

const Dashboard = () => {
  const { 
    dashboardData, 
    loading, 
    error, 
    fetchDashboardData, 
    dateRange, 
    setDateRange: _setDateRange,
    fetchDashboardForDays
  } = useHealthData();
  // explicitly ignore setDateRange in this view
  void _setDateRange;

  const [selectedMetric, setSelectedMetric] = useState('energy_level');
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboardData();
    }
  }, [dashboardData, fetchDashboardData]);

  if (loading && !dashboardData) {
    return <LoadingSpinner message="Loading dashboard data..." />;
  }

  if (error && !dashboardData) {
    return <ErrorMessage message={error} onRetry={fetchDashboardData} />;
  }

  const stats = dashboardData?.stats || {};
  const healthData = dashboardData?.healthData || [];
  const windowDataFromContext = dashboardData?.windowData || null;
  const correlations = dashboardData?.correlations || [];
  // Normalize correlations into an array. Prefer backend's `significant_correlations` when available
  const correlationsArr = Array.isArray(correlations)
    ? correlations
    : (correlations && typeof correlations === 'object'
      ? (Array.isArray(correlations.significant_correlations) ? correlations.significant_correlations : (Array.isArray(correlations.items) ? correlations.items : Object.values(correlations)))
      : []);

  // Ensure healthData is sorted newest-first (backend may vary)
  const parseDate = (d) => {
    if (!d) return null;
    const s = d.day || d.date || d.timestamp;
    const dd = s ? new Date(s) : null;
    return dd && !Number.isNaN(dd.getTime()) ? dd : null;
  };
  // If provider already sliced windowData, trust it; else fall back to local sort & slice.
  let windowData = Array.isArray(windowDataFromContext) ? windowDataFromContext : [];
  if (!windowData.length && Array.isArray(healthData) && healthData.length) {
    const sorted = [...healthData].sort((a,b) => {
      const da = parseDate(a); const db = parseDate(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return db - da;
    });
    windowData = sorted.slice(0, Number(dateRange) || 30);
  }
  const recentData = windowData;

  // Calculate energy level average with proper null handling
  const energyLevels = recentData
    .map(d => (d && typeof d.energy_level === 'number' && !isNaN(d.energy_level)) ? d.energy_level : null)
    .filter(level => level !== null);
  const avgEnergy = energyLevels.length > 0 
    ? (energyLevels.reduce((sum, level) => sum + level, 0) / energyLevels.length).toFixed(1)
    : 'N/A';
  
  // Calculate sleep score average with proper null handling
  const sleepScores = recentData
    .map(d => (d && typeof d.sleep_score === 'number' && !isNaN(d.sleep_score)) ? d.sleep_score : null)
    .filter(score => score !== null);
  const avgSleep = sleepScores.length > 0
    ? Math.round(sleepScores.reduce((sum, score) => sum + score, 0) / sleepScores.length)
    : 'N/A';

  // Calculate average steps with proper null handling
  const stepsData = recentData
    .map(d => (d && typeof d.steps === 'number' && !isNaN(d.steps)) ? d.steps : null)
    .filter(steps => steps !== null);
  const avgSteps = stepsData.length > 0
    ? Math.round(stepsData.reduce((sum, steps) => sum + steps, 0) / stepsData.length)
    : 'N/A';

  // Calculate average resting heart rate with proper null handling
  const rhrData = recentData
    .map(d => (d && typeof d.rhr === 'number' && !isNaN(d.rhr)) ? d.rhr : null)
    .filter(rhr => rhr !== null);
  const avgRHR = rhrData.length > 0
    ? Math.round(rhrData.reduce((sum, rhr) => sum + rhr, 0) / rhrData.length)
    : 'N/A';

  // --- Additional computed insights ---
  const formatMinutesToTime = (mins) => {
    if (mins == null || Number.isNaN(Number(mins))) return 'N/A';
    const total = Math.round(mins) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Use backend field `time_in_bed_minutes` (from SQL alias) if present
  const sleepDurations = recentData
    .map(d => (d && d.time_in_bed_minutes != null && !isNaN(Number(d.time_in_bed_minutes))) ? Number(d.time_in_bed_minutes) : null)
    .filter(v => v != null);

  // Try to extract bedtime minute-of-day from `sleep_start` timestamp if backend provides it
  const bedtimeMins = recentData
    .map(d => {
      if (d && d.sleep_start) {
        const dt = new Date(d.sleep_start);
        if (!Number.isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
      }
      if (d && d.bedtime_minutes != null && !isNaN(Number(d.bedtime_minutes))) return Number(d.bedtime_minutes);
      return null;
    })
    .filter(v => v != null);
  const mean = (arr) => arr && arr.length ? arr.reduce((a,b) => a+b,0)/arr.length : null;
  const variance = (arr) => { if (!arr || arr.length === 0) return null; const m = mean(arr); return arr.reduce((s,v)=>s+Math.pow(v-m,2),0)/arr.length; };
  const sleepStdMin = sleepDurations.length ? Math.sqrt(variance(sleepDurations)) : null;

  const median = (arr) => { if (!arr || !arr.length) return null; const a = [...arr].sort((x,y)=>x-y); const mid = Math.floor(a.length/2); return a.length%2 ? a[mid] : (a[mid-1]+a[mid])/2; };
  const medianBedMin = median(bedtimeMins);

  const availableDays = (recentData || []).length;
  const nightsWithSleep = sleepDurations.length;
  const nightsWithBedtime = bedtimeMins.length;

  const pluralize = (n, singular, plural = null) => {
    if (n == null) return singular;
    return n === 1 ? singular : (plural || (singular + 's'));
  };

  // Steps streaks (threshold 7000 by default)
  const stepThreshold = 7000;
  let longestStepStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < (windowData || []).length; i++) {
    const s = windowData[i]?.steps;
    if (s != null && !isNaN(Number(s)) && Number(s) >= stepThreshold) { currentStreak += 1; longestStepStreak = Math.max(longestStepStreak, currentStreak); }
    else currentStreak = 0;
  }

  // RHR trend: compare avg of most recent half of recentData vs previous half
  let rhrTrendText = 'No trend';
  try {
    const arr = recentData.map(d => (d && d.rhr != null && !isNaN(Number(d.rhr))) ? Number(d.rhr) : null).filter(v=>v!=null);
    if (arr.length >= 2) {
      const half = Math.floor(arr.length/2);
      const recentHalf = arr.slice(0, half);
      const prevHalf = arr.slice(half);
      const avgRecent = mean(recentHalf);
      const avgPrev = mean(prevHalf);
      if (avgRecent != null && avgPrev != null) {
        const diff = +(avgRecent - avgPrev).toFixed(1);
        if (Math.abs(diff) >= 3) rhrTrendText = diff > 0 ? `RHR increased by ${diff} bpm vs previous period` : `RHR decreased by ${Math.abs(diff)} bpm vs previous period`;
        else rhrTrendText = `RHR stable (Δ ${diff} bpm)`;
      }
    }
  } catch (e) { /* ignore */ }

  // Notable correlations will be derived from preparedCorrelations below

  // Prepare correlations for display: filter invalid, dedupe symmetric pairs, sort by absolute correlation
  const prepareCorrelations = (raw) => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const c of raw) {
      if (!c || typeof c.correlation !== 'number') continue;
      const f1 = String(c.field1 || c.fieldA || c.x || '').trim();
      const f2 = String(c.field2 || c.fieldB || c.y || '').trim();
      if (!f1 || !f2 || f1 === f2) continue;
      const key = [f1, f2].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ field1: f1, field2: f2, correlation: c.correlation, n: c.n || c.count || 0 });
    }
    return out.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  };

  const preparedCorrelations = prepareCorrelations(correlationsArr || []);
  const topCorrelations = preparedCorrelations.slice(0, 12);
  const correlationsCount = preparedCorrelations.length;
  const notableCorrelations = preparedCorrelations.filter(c => c && typeof c.correlation === 'number' && (c.n || 0) > 5 && Math.abs(c.correlation) >= 0.35).slice(0,5);

  // --- Helpers for Overview trends ---
  const firstNumeric = (field, arr) => {
    if (!Array.isArray(arr)) return null;
    for (const r of arr) {
      const v = r?.[field];
      if (v != null && !isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  const lastNumeric = (field, arr) => {
    if (!Array.isArray(arr)) return null;
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i]?.[field];
      if (v != null && !isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  const computeTrend = (field, arr) => {
    const recent = firstNumeric(field, arr);
    const older = lastNumeric(field, arr);
    if (recent == null || older == null) return null;
    return +(recent - older).toFixed(1);
  };

  return (
    <div className="dashboard fade-in">
      <DashboardHeader
        dateRange={dateRange}
        onSelectDays={fetchDashboardForDays}
        availableDays={availableDays}
      />

      {/* Key Metrics */}
      <MetricsGrid
        avgEnergy={avgEnergy}
        avgSleep={avgSleep}
        avgSteps={avgSteps}
        avgRHR={avgRHR}
        computeTrend={computeTrend}
        recentData={recentData}
      />

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container-wrapper">
          <HealthTrendsCard
            selectedMetric={selectedMetric}
            onChangeMetric={setSelectedMetric}
            windowData={windowData}
          />
        </div>

        {/* Correlation Matrix */}
    {correlationsCount > 0 && (
          <div className="correlation-section">
            <div className="card">
              <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h3 className="card-title">Health Correlations</h3>
                  <p className="card-subtitle">Top relationships in the selected window ({correlationsCount})</p>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                  <button className="btn-small" onClick={() => setShowFullMatrix(s => !s)}>{showFullMatrix ? 'Show compact' : 'Show full matrix'}</button>
                </div>
              </div>
              <div style={{padding: 12}}>
                {!showFullMatrix ? (
                  <ul style={{margin: 0, paddingLeft: 16}}>
                    {topCorrelations.map((c, i) => (
                      <li key={i} style={{marginBottom: 6}}>
                        <strong>{c.field1}</strong> ↔ <strong>{c.field2}</strong>: r = {c.correlation.toFixed(2)} (n={c.n})
                      </li>
                    ))}
                    {preparedCorrelations.length > topCorrelations.length && (
                      <li style={{marginTop: 8, color: '#475569'}}>And {preparedCorrelations.length - topCorrelations.length} more — switch to full matrix to explore.</li>
                    )}
                  </ul>
                ) : (
                  <CorrelationMatrix data={preparedCorrelations} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <DataOverviewCard stats={stats} />
      </div>

      {/* Insights & Highlights */}
      <div className="insights-section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Insights & Highlights</h3>
          </div>
          <div className="card-content">
            {loading ? (
              <div style={{padding: 12}}><LoadingSpinner message="Computing insights..." small /></div>
            ) : (
              <>
                <div style={{marginBottom: 8, fontStyle: 'italic', color: '#475569'}}>
                  { /* One-line takeaway */ }
                  {(() => {
                    // Heuristic takeaway
                    if (nightsWithSleep === 0) return 'Not enough sleep data to draw conclusions — try widening the range.';
                    if (sleepStdMin != null && sleepStdMin > 60) return 'Sleep timing is quite variable; consider regularizing bedtime.';
                    if (avgRHR !== 'N/A' && Number(avgRHR) > 80) return 'Elevated resting HR — consider stress or recovery behaviors.';
                    return 'Overall: data looks sufficient for basic trends.';
                  })()}
                </div>
                <ul className="insights-list">
              <li>
                <strong>Sleep consistency:</strong>{' '}
                {nightsWithSleep > 0 ? (
                  <span>{`${Math.round(sleepStdMin ?? 0)} min SD across ${nightsWithSleep} ${pluralize(nightsWithSleep, 'night')} (avg ${sleepDurations.length ? Math.round(mean(sleepDurations)) + ' min' : 'N/A'})`}</span>
                ) : (
                  <span>{`No sleep-session duration data for the selected window (${availableDays} ${pluralize(availableDays, 'day')}). Try widening to 90 days.`}</span>
                )}
              </li>
              <li>
                <strong>Typical bedtime:</strong>{' '}
                {nightsWithBedtime > 0 ? (
                  <span>{`${formatMinutesToTime(medianBedMin)} (median across ${nightsWithBedtime} ${pluralize(nightsWithBedtime, 'night')})`}</span>
                ) : (
                  <span>{`Bedtime not tracked in this window (${availableDays} ${pluralize(availableDays, 'day')}).`}</span>
                )}
              </li>
              <li>
                <strong>Steps summary:</strong>{' '}
                <span>{`Longest streak ≥${stepThreshold.toLocaleString()} steps: ${longestStepStreak} ${pluralize(longestStepStreak, 'day')} (of ${availableDays} tracked ${pluralize(availableDays, 'day')}); avg steps ${avgSteps !== 'N/A' ? avgSteps.toLocaleString() : 'N/A'}.`}</span>
              </li>
              <li>
                <strong>Resting HR:</strong>{' '}
                <span>{avgRHR !== 'N/A' ? `${avgRHR} bpm — ${rhrTrendText}` : `${rhrTrendText} (no average RHR available)`}</span>
              </li>
              {notableCorrelations.length > 0 ? (
                <li>
                  <strong>Notable correlations:</strong>
                  <ul>
                    {notableCorrelations.map((c, idx) => (
                      <li key={idx}>{c.field1} ↔ {c.field2}: r = {c.correlation != null ? c.correlation.toFixed(2) : 'N/A'} (n={c.n}){(lowerIsBetterNote(c.field1) || lowerIsBetterNote(c.field2))}</li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li><strong>Notable correlations:</strong> None strong enough in the selected range. Try widening the range to {dateRange} days if you expected more patterns.</li>
              )}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .dark .page-title {
          color: #f1f5f9;
        }

        .page-subtitle {
          color: #64748b;
          margin: 0;
        }

        .dark .page-subtitle {
          color: #94a3b8;
        }

        .dashboard-controls {
          display: flex;
          gap: 12px;
        }

        .date-range-select,
        .metric-select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          color: #1e293b;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .dark .date-range-select,
        .dark .metric-select {
          background: #334155;
          border-color: #475569;
          color: #f1f5f9;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .charts-section {
          margin-bottom: 32px;
        }

        .chart-container-wrapper {
          margin-bottom: 24px;
        }

        .correlation-section {
          margin-top: 24px;
        }

        .quick-stats {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 24px;
        }

        .stat-item {
          text-align: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .dark .stat-item {
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

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
          }

          .page-title {
            font-size: 1.5rem;
          }

          .metrics-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }

          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;