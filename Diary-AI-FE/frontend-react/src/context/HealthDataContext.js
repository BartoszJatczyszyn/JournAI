import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { healthAPI, analyticsAPI } from '../services';
import toast from 'react-hot-toast';

const HealthDataContext = createContext();

export const useHealthData = () => {
  const context = useContext(HealthDataContext);
  if (!context) {
    throw new Error('useHealthData must be used within a HealthDataProvider');
  }
  return context;
};

export const HealthDataProvider = ({ children }) => {
  // Use a counter for concurrent loading operations so overlapping fetches
  // don't flip the global loading flag prematurely. Keep backward-compatible
  // `setLoading` that accepts boolean (true => increment, false => decrement)
  // or a numeric delta. Expose `loading` as boolean for existing consumers.
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;

  const setLoading = (val) => {
    // If called with a boolean, increment on true and decrement on false
    if (typeof val === 'boolean') {
      setLoadingCount(prev => val ? prev + 1 : Math.max(0, prev - 1));
      return;
    }
    // If called with a number, treat as delta
    if (typeof val === 'number') {
      setLoadingCount(prev => Math.max(0, prev + Math.trunc(val)));
      return;
    }
    // Special reset command
    if (val === 'reset') {
      setLoadingCount(0);
      return;
    }
    // Fallback: if nothing sensible provided, do nothing
    console.warn('setLoading called with unsupported value:', val);
  };
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [insights, setInsights] = useState(null);
  const [dateRange, setDateRange] = useState(30);

  // --- INTERNAL UTILS -----------------------------------------------------
  const requestSeqRef = useRef(0); // monotonic sequence for race guarding

  const normalizeHealthData = useCallback((raw, days) => {
    if (!Array.isArray(raw)) return [];
    const parseDay = (d) => {
      if (!d) return null;
      const s = d.day || d.date || d.timestamp;
      if (!s) return null;
      const dt = new Date(s);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };
    const numericKeys = ['steps','energy_level','sleep_score','rhr','stress_avg','calories_total','mood'];
    const cleaned = raw
      .filter(r => !!r)
      .map(r => ({ ...r, _dayObj: parseDay(r) }))
      // keep rows that have at least one meaningful metric (non-null & not NaN)
      .filter(r => numericKeys.some(k => r[k] != null && !Number.isNaN(Number(r[k]))));
    // Sort newest first (most recent day first) so slice(0, days) is the current window anchored on last real day
    cleaned.sort((a,b) => {
      const da = a._dayObj ? a._dayObj.getTime() : -Infinity;
      const db = b._dayObj ? b._dayObj.getTime() : -Infinity;
      return db - da;
    });
    const windowData = typeof days === 'number' && days > 0 ? cleaned.slice(0, days) : cleaned;
    return { all: cleaned, window: windowData };
  }, []);

  // Fetch dashboard overview data (race guarded)
  const fetchDashboardData = useCallback(async () => {
    const reqId = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      const [statsData, healthDataRaw, correlationsData] = await Promise.all([
        healthAPI.getStats(),
        healthAPI.getHealthData(dateRange),
        healthAPI.getEnhancedCorrelations(dateRange)
      ]);

      // Normalize & slice window
      const { all: normalized, window: windowSlice } = normalizeHealthData(healthDataRaw, dateRange);

      // If a newer request finished first, abandon state update
      if (reqId !== requestSeqRef.current) return;

      setDashboardData({
        stats: statsData,
        healthData: normalized,
        windowData: windowSlice,
        correlations: correlationsData
      });
    } catch (err) {
      if (reqId === requestSeqRef.current) {
        setError('Failed to fetch dashboard data');
        toast.error('Failed to load dashboard data');
      }
      console.error('Dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, normalizeHealthData]);

  // Fetch dashboard data for a specific days window and update dateRange (race guarded)
  const fetchDashboardForDays = useCallback(async (days = 30) => {
    const reqId = ++requestSeqRef.current;
    // Optimistic immediate range change so UI updates headers/buttons
    setDateRange(days);
    try {
      setLoading(true);
      setError(null);

      // Fire requests in parallel
      const [statsData, healthDataRaw, correlationsData] = await Promise.all([
        healthAPI.getStats(),
        healthAPI.getHealthData(days),
        healthAPI.getEnhancedCorrelations(days)
      ]);

      const { all: normalized, window: windowSlice } = normalizeHealthData(healthDataRaw, days);

      if (reqId !== requestSeqRef.current) return; // stale response

      setDashboardData(prev => ({
        // If previous data exists keep any other properties
        ...(prev || {}),
        stats: statsData,
        healthData: normalized,
        windowData: windowSlice,
        correlations: correlationsData
      }));
    } catch (err) {
      if (reqId === requestSeqRef.current) {
        setError('Failed to fetch dashboard data');
        toast.error('Failed to load dashboard data');
      }
      console.error('Dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  }, [normalizeHealthData]);

  // Fetch enhanced analytics
  const fetchAnalytics = useCallback(async (days = 90, clusters = 3, recoveryFilters = null) => {
    try {
      setLoading(true);
      setError(null);

      console.log('fetchAnalytics: requesting analytics for', { days, clusters, recoveryFilters });
      const [
        comprehensiveData,
        correlationsData,
        clustersData,
        temporalData,
        recoveryData
      ] = await Promise.all([
        healthAPI.getEnhancedComprehensive(days),
        healthAPI.getEnhancedCorrelations(days),
        healthAPI.getClusterAnalysis(days, clusters),
        healthAPI.getTemporalPatterns(days),
        healthAPI.getRecoveryAnalysis({ days, ...(recoveryFilters || {}) })
      ]);

      // Debug: log what we received from analytics endpoints (helps debug empty/malformed responses)
      try {
        console.log('fetchAnalytics: received analytics responses', {
          comprehensive: comprehensiveData && (comprehensiveData.data ? '(wrapped)':'(raw)'),
          correlations: correlationsData && (correlationsData.data ? '(wrapped)':'(raw)'),
          clusters: clustersData && (clustersData.data ? '(wrapped)':'(raw)'),
          temporal: temporalData && (temporalData.data ? '(wrapped)':'(raw)'),
          recovery: recoveryData
        });
      } catch (logErr) {
        console.warn('fetchAnalytics: logging failed', logErr);
      }

      setAnalytics({
        comprehensive: comprehensiveData,
        correlations: correlationsData,
        clusters: clustersData,
        temporal: temporalData,
        recovery: recoveryData
      });
    } catch (err) {
      setError('Failed to fetch analytics data');
      toast.error('Failed to load analytics data');
      console.error('Analytics data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch predictions
  const fetchPredictions = useCallback(async (daysAhead = 7) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch core prediction endpoints in parallel (these exist)
      const [
        energyPredictions,
        sleepPredictions,
        moodPredictions,
        comprehensivePredictions
      ] = await Promise.all([
        healthAPI.getEnergyPredictions(daysAhead).catch(e => { console.warn('Energy predictions failed:', e); return { status: 'error', predictions: [], message: e.message }; }),
        healthAPI.getSleepPredictions(daysAhead).catch(e => { console.warn('Sleep predictions failed:', e); return { status: 'error', predictions: [], message: e.message }; }),
        healthAPI.getMoodPredictions(daysAhead).catch(e => { console.warn('Mood predictions failed:', e); return { status: 'error', predictions: [], message: e.message }; }),
        healthAPI.getComprehensivePredictions(daysAhead).catch(e => { console.warn('Comprehensive predictions failed:', e); return { status: 'error', predictions: {}, message: e.message }; })
      ]);

      // Attempt health trends (endpoint currently missing -> graceful fallback)
      let healthTrends = null;
      try {
        healthTrends = await healthAPI.getHealthTrends(90);
      } catch (trendErr) {
        console.warn('Health trends endpoint unavailable (non-fatal):', trendErr.message || trendErr);
      }

      setPredictions(prev => ({
        ...(prev || {}),
        energy: energyPredictions,
        sleep: sleepPredictions,
        mood: moodPredictions,
        comprehensive: comprehensivePredictions,
        trends: healthTrends || { status: 'unavailable', message: 'Health trends endpoint not available' }
      }));

      // If ALL prediction categories failed, surface a user-visible error
      const allFailed = [energyPredictions, sleepPredictions, moodPredictions, comprehensivePredictions]
        .every(p => !p || p.status === 'error');
      if (allFailed) {
        setError('All prediction endpoints failed');
        toast.error('All prediction endpoints failed');
      }
    } catch (err) {
      setError('Failed to fetch predictions data');
      toast.error('Failed to load predictions data');
      console.error('Predictions data error (wrapper):', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch personalized insights
  const fetchInsights = useCallback(async (days = 90) => {
    try {
      setLoading(true);
      setError(null);

      const [
        personalizedData,
        optimizationData,
        sleepAnalysis,
        stressAnalysis,
        activityAnalysis
      ] = await Promise.all([
        healthAPI.getPersonalizedInsights(days),
        healthAPI.getOptimizationInsights(days, 'energy_level'),
        healthAPI.getSleepAnalysis(30),
        healthAPI.getStressAnalysis(30),
        healthAPI.getActivityAnalysis(30)
      ]);

      setInsights({
        personalized: personalizedData,
        optimization: optimizationData,
        sleep: sleepAnalysis,
        stress: stressAnalysis,
        activity: activityAnalysis
      });
    } catch (err) {
      setError('Failed to fetch insights data');
      toast.error('Failed to load insights data');
      console.error('Insights data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch specialized analysis with enhanced error handling and logging
  const fetchSpecializedAnalysis = useCallback(async (type, days = 30) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      console.log(`Fetching ${type} analysis for ${days} days`);
      setLoading(true);
      setError(null);

      let data;
      const options = { 
        signal: controller.signal,
        validateStatus: (status) => status < 500 // Don't throw for 4xx errors
      };
      
      let response;
      switch (type) {
        case 'sleep':
          console.log('Fetching sleep analysis via analyticsAPI...');
          try {
            data = await analyticsAPI.getSleepAnalysis(days, options);
            break;
          } catch (e) {
            console.warn('Sleep specialized endpoint failed, falling back to enhanced comprehensive:', e);
          }
          data = await analyticsAPI.getEnhancedComprehensive(days);
          break;
          
        case 'stress':
          console.log('Fetching stress analysis via analyticsAPI...');
          data = await analyticsAPI.getStressAnalysis(days, options);
          break;
          
        case 'activity':
          response = await healthAPI.getActivityAnalysis(days, options);
          data = response?.data;
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${type}`);
      }

      if (!data) {
        throw new Error(`No data received for ${type} analysis`);
      }
      
      // Handle new backend structure - check for insights.error
      if (data.insights && data.insights.error) {
        console.log(`Backend returned insights error: ${data.insights.error}`);
        clearTimeout(timeoutId);
        return {
          ...data,
          message: data.insights.error === 'No data available' ? 'No data available' : data.insights.error
        };
      }
      
      if (data.error) {
        clearTimeout(timeoutId);
        throw new Error(data.error);
      }

      console.log(`Successfully fetched ${type} data:`, data);
      clearTimeout(timeoutId);
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Request timeout') {
        toast.error('Request timed out. Please try again with a smaller date range.');
        setError('Request timed out. Try a smaller date range.');
      } else {
        setError(`Failed to fetch ${type} analysis`);
        toast.error(`Failed to load ${type} analysis`);
        console.error(`${type} analysis error:`, err);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  // Compare time periods
  const comparePeriods = useCallback(async (period1Days = 30, period2Days = 30, offsetDays = 30) => {
    try {
      setLoading(true);
      setError(null);

      const comparisonData = await healthAPI.comparePeriods(period1Days, period2Days, offsetDays);
      return comparisonData;
    } catch (err) {
      setError('Failed to fetch comparison data');
      toast.error('Failed to load comparison data');
      console.error('Comparison data error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get health data for specific date range
  const getHealthDataForRange = useCallback(async (days) => {
    try {
      setLoading(true);
      setError(null);

      const data = await healthAPI.getHealthData(days);
      return data;
    } catch (err) {
      setError('Failed to fetch health data');
      toast.error('Failed to load health data');
      console.error('Health data error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        fetchDashboardData(),
        fetchAnalytics(),
        fetchPredictions(),
        fetchInsights()
      ]);

      toast.success('Data refreshed successfully');
    } catch (err) {
      setError('Failed to refresh data');
      toast.error('Failed to refresh data');
      console.error('Refresh data error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics, fetchDashboardData, fetchInsights, fetchPredictions]);

  // Initialize data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const value = useMemo(() => ({
    // State
    loading,
    error,
  dashboardData,
  windowData: dashboardData?.windowData || null,
    analytics,
    predictions,
    insights,
    dateRange,

    // Actions
    setDateRange,
    fetchDashboardData,
    fetchDashboardForDays,
    fetchAnalytics,
    fetchPredictions,
    fetchInsights,
    fetchSpecializedAnalysis,
    comparePeriods,
    getHealthDataForRange,
    refreshAllData,

    // Utilities
    clearError: () => setError(null),
    setLoading
  }), [loading, error, dashboardData, analytics, predictions, insights, dateRange, fetchDashboardData, fetchDashboardForDays, fetchAnalytics, fetchPredictions, fetchInsights, fetchSpecializedAnalysis, comparePeriods, getHealthDataForRange, refreshAllData]);

  return (
    <HealthDataContext.Provider value={value}>
      {children}
    </HealthDataContext.Provider>
  );
};