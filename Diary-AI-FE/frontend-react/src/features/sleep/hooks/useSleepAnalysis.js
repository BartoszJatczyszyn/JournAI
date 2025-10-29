import { useState, useEffect, useMemo, useCallback } from 'react';
import { useHealthData } from 'context/HealthDataContext';
import { sleepsAPI } from '../api';
import { mmToHHMM, circularMeanMinutes, windowAround, circularRollingMedian } from 'utils/timeUtils';

// Constants for better readability
const RECOMMENDED_SLEEP_TARGET_MINUTES = 7.5 * 60;

export const useSleepAnalysis = (defaultDays = 14) => {
  const { error: ctxError, fetchSpecializedAnalysis, getHealthDataForRange } = useHealthData();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [sleepData, setSleepData] = useState(null);
  const [analysisParams, setAnalysisParams] = useState({ days: defaultDays });

  // Load saved period from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sleep_period_days');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          setAnalysisParams(prev => ({ ...prev, days: parsed }));
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }
  }, []);

  // Fetch data when params change
  const loadSleepAnalysis = useCallback(async () => {
    console.log('Fetching sleep analysis for', analysisParams.days, 'days');
    setLocalLoading(true);
    setLocalError(null);
    try {
      // 1) Always fetch latest sessions from garmin_sleep_sessions as the primary source
      // We use getLatestSleeps with limit=analysisParams.days to anchor on the most recent days available in DB
      const latest = await sleepsAPI.getLatestSleeps({ limit: Math.max(1, analysisParams.days) });
      const latestSessions = Array.isArray(latest?.sleeps) ? latest.sleeps : (Array.isArray(latest) ? latest : []);

      // Helper: normalize various possible timeseries keys into canonical UI fields
      const normalizeTimeseriesRow = (r) => {
        if (!r) return r;
        const toMin = (sec) => (sec != null ? Math.round(Number(sec) / 60) : null);
        return {
          ...r,
          // Prefer explicit *_minutes fields, then convert any *_seconds fields to minutes
          sleep_duration_minutes: r.sleep_duration_minutes ??
            (r.sleep_duration_seconds ? toMin(r.sleep_duration_seconds) : null) ??
            r.time_in_bed_minutes ??
            (r.time_in_bed_seconds ? toMin(r.time_in_bed_seconds) : null) ??
            r.sleep_minutes ??
            (r.duration_min ?? null) ??
            (r.duration_seconds ? toMin(r.duration_seconds) : null) ??
            (r.sleep_duration ? Number(r.sleep_duration) : null),
          deep_sleep_minutes: r.deep_sleep_minutes ?? r.deep_minutes ?? (r.deep_sleep_seconds ? toMin(r.deep_sleep_seconds) : null) ?? null,
          rem_sleep_minutes: r.rem_sleep_minutes ?? r.rem_minutes ?? (r.rem_sleep_seconds ? toMin(r.rem_sleep_seconds) : null) ?? null,
          light_sleep_minutes: r.light_sleep_minutes ?? r.light_minutes ?? (r.light_sleep_seconds ? toMin(r.light_sleep_seconds) : null) ?? null,
          awake_minutes: r.awake_minutes ?? r.awake_minutes ?? (r.awake_seconds ? toMin(r.awake_seconds) : null) ?? null,
          // Strict: only use the per-session aggregated avg_sleep_hr column for Avg Heart Rate per Sleep
          avg_sleep_hr: r.avg_sleep_hr ?? null,
          rhr: r.avg_sleep_hr ?? null,
          avg_sleep_rr: r.avg_sleep_rr ?? r.avg_respiration ?? r.respiratory_rate ?? r.respRate ?? null,
          respiratory_rate: r.avg_sleep_rr ?? r.avg_respiration ?? r.respiratory_rate ?? r.respRate ?? null,
          avg_sleep_stress: r.avg_sleep_stress ?? r.stress_avg ?? r.stress ?? null,
          stress_avg: r.avg_sleep_stress ?? r.stress_avg ?? r.stress ?? null,
        };
      };

      const mapSessionToTs = (s) => {
        const toMinutesOfDay = (iso) => {
          if (!iso) return null;
          try {
            const d = new Date(iso);
            return d.getHours() * 60 + d.getMinutes();
          } catch { return null; }
        };
        const base = {
          day: s.day || s.date || (s.sleep_start ? new Date(s.sleep_start).toISOString().slice(0,10) : undefined),
          bedtime_minutes: s.bedtime_minutes ?? toMinutesOfDay(s.sleep_start),
          wake_minutes: s.wake_minutes ?? toMinutesOfDay(s.sleep_end),
          energy_level: s.energy_level ?? null,
          mood: s.mood ?? null,
        };
        return normalizeTimeseriesRow({ ...base, ...s });
      };

      let latestTimeseries = latestSessions.map(mapSessionToTs).filter(d => d.day);

      // Small helper to fetch latest sleeps directly from enhanced backend
      const fetchLatestSleepsDirect = async () => {
        try {
          const j = await sleepsAPI.getLatestSleeps({ limit: analysisParams.days });
          if (Array.isArray(j?.sleeps) && j.sleeps.length) return j.sleeps;

          // Fallback: try the enhanced comprehensive insights which may include daily_summary with avg_sleep_hr
          try {
            const { analyticsAPI } = await import('../../../infrastructure/api');
            const comp = await analyticsAPI.getEnhancedComprehensive(analysisParams.days);
            
            const daily = comp?.insights?.daily_summary || comp?.insights?.dailySummaries || [];
            if (Array.isArray(daily) && daily.length) {
              // normalize daily_summary entries to sleep-like objects
              return daily.map(d => ({
                day: d.day || d.date,
                avg_sleep_hr: d.avg_sleep_hr ?? d.rhr ?? null,
                avg_sleep_rr: d.avg_sleep_rr ?? d.respiratory_rate ?? null,
                avg_sleep_stress: d.avg_sleep_stress ?? d.stress_avg ?? null,
              }));
            }
          } catch (e) {
            console.warn('Enhanced comprehensive fallback failed:', e);
          }

          return [];
        } catch (e) {
          console.warn('Failed to fetch latest sleeps directly:', e);
          return [];
        }
      };

      const mergeAvgVitalsFromSleeps = async (tsArr) => {
        // merge per-session aggregated vitals (hr, rr, stress) from latest sleeps into timeseries when missing
        if (!Array.isArray(tsArr) || !tsArr.length) return tsArr;
        try {
          const sleeps = await fetchLatestSleepsDirect();
          if (!sleeps || !sleeps.length) return tsArr;
          const byDay = new Map(sleeps.map(s => [String(s.day), s]));
          return tsArr.map(row => {
            const dayKey = String(row?.day);
            const sleepRow = byDay.get(dayKey);
            if (!sleepRow) return row;
            const out = { ...row };
            if ((out.avg_sleep_hr == null || out.rhr == null) && sleepRow.avg_sleep_hr != null) {
              out.avg_sleep_hr = sleepRow.avg_sleep_hr;
              out.rhr = out.rhr ?? sleepRow.avg_sleep_hr;
            }
            if ((out.avg_sleep_rr == null || out.respiratory_rate == null) && (sleepRow.avg_sleep_rr != null || sleepRow.avg_respiration != null || sleepRow.respiratory_rate != null)) {
              out.avg_sleep_rr = out.avg_sleep_rr ?? (sleepRow.avg_sleep_rr ?? sleepRow.avg_respiration ?? sleepRow.respiratory_rate ?? null);
              out.respiratory_rate = out.respiratory_rate ?? out.avg_sleep_rr;
            }
            if ((out.avg_sleep_stress == null || out.stress_avg == null) && (sleepRow.avg_sleep_stress != null || sleepRow.stress_avg != null || sleepRow.stress != null)) {
              out.avg_sleep_stress = out.avg_sleep_stress ?? (sleepRow.avg_sleep_stress ?? sleepRow.stress_avg ?? sleepRow.stress ?? null);
              out.stress_avg = out.stress_avg ?? out.avg_sleep_stress;
            }
            return out;
          });
        } catch (e) {
          console.warn('mergeAvgVitalsFromSleeps failed:', e);
          return tsArr;
        }
      };

      // Merge previous-day stress from health data into timeseries rows as `prev_stress`.
      const mergePrevStressFromHealth = async (tsArr) => {
        if (!Array.isArray(tsArr) || !tsArr.length) return tsArr;
        try {
          const health = await getHealthDataForRange(analysisParams.days + 1);
          if (!Array.isArray(health) || !health.length) return tsArr;
          const healthByDay = new Map(health.map(h => [String(h.day), h]));
          return tsArr.map(row => {
            const out = { ...row };
            try {
              // compute previous day key YYYY-MM-DD
              if (out.day) {
                const d = new Date(out.day);
                d.setDate(d.getDate() - 1);
                const key = d.toISOString().slice(0, 10);
                const prev = healthByDay.get(key);
                if (prev && (out.prev_stress == null || out.prev_stress === undefined)) {
                  out.prev_stress = prev.stress_avg ?? prev.avg_sleep_stress ?? null;
                }
              }
            } catch (e) {
              // ignore per-row errors
            }
            return out;
          });
        } catch (e) {
          console.warn('mergePrevStressFromHealth failed:', e);
          return tsArr;
        }
      };

      // 2) Fetch specialized insights (sleep-specific or enhanced fallback)
      const data = await fetchSpecializedAnalysis('sleep', analysisParams.days);
      console.log('Received sleep data:', data);
      if (data) {
        console.log('Setting sleep data with keys:', Object.keys(data));
        
        // Handle the enhanced comprehensive API response structure
        if (data.status === 'success' && data.insights) {
          console.log('Processing enhanced comprehensive response');

          // Try to build timeseries from comprehensive.insights if available
          let timeseries = [];
          const comp = data.insights;
          // Attempt to build from any daily summaries within insights
          if (Array.isArray(comp?.daily_summary)) {
                timeseries = comp.daily_summary.map(d => ({
                day: d.day || d.date,
                sleep_score: d.sleep_score,
                sleep_duration_minutes: d.sleep_duration_minutes ?? (d.sleep_duration_seconds ? Math.round(Number(d.sleep_duration_seconds)/60) : (d.sleep_duration ?? null)) ?? null,
                deep_sleep_minutes: d.deep_sleep_minutes ?? (d.deep_sleep_seconds ? Math.round(Number(d.deep_sleep_seconds)/60) : null) ?? null,
                rem_sleep_minutes: d.rem_sleep_minutes ?? (d.rem_sleep_seconds ? Math.round(Number(d.rem_sleep_seconds)/60) : null) ?? null,
                light_sleep_minutes: d.light_sleep_minutes ?? (d.light_sleep_seconds ? Math.round(Number(d.light_sleep_seconds)/60) : null) ?? null,
                awake_minutes: d.awake_minutes ?? (d.awake_seconds ? Math.round(Number(d.awake_seconds)/60) : null) ?? null,
                bedtime_minutes: d.bedtime_minutes ?? null,
                wake_minutes: d.wake_minutes ?? null,
              avg_sleep_hr: d.avg_sleep_hr ?? d.rhr ?? d.resting_heart_rate ?? null,
              rhr: d.avg_sleep_hr ?? d.rhr ?? d.resting_heart_rate ?? null,
              hrv_avg: d.hrv_avg ?? null,
              avg_sleep_rr: d.avg_sleep_rr ?? d.respiratory_rate ?? null,
              respiratory_rate: d.avg_sleep_rr ?? d.respiratory_rate ?? null,
              avg_sleep_stress: d.avg_sleep_stress ?? d.stress_avg ?? d.stress ?? null,
              stress_avg: d.avg_sleep_stress ?? d.stress_avg ?? d.stress ?? null,
              steps: d.steps ?? null,
              energy_level: d.energy_level ?? null,
              mood: d.mood ?? null,
            }));
          } else if (Array.isArray(comp?.timeseries)) {
            timeseries = (comp.timeseries || []).map(row => {
              const n = normalizeTimeseriesRow(row || {});
              n.day = n.day || n.date;
              return n;
            });
          } else {
            // fallback: pull from health data endpoint for consistency in charts
            try {
              const health = await getHealthDataForRange(analysisParams.days);
              if (Array.isArray(health)) {
                timeseries = health.map(d => {
                  const n = normalizeTimeseriesRow(d || {});
                  n.day = n.day || n.date || d.day;
                  return n;
                });
              }
            } catch (e) {
              console.warn('Fallback health data fetch failed:', e);
            }
          }

              // reuse outer fetchLatestSleepsDirect helper defined earlier

              // duplicate helper removed - original mergeAvgVitalsFromSleeps defined above is used

              // Merge timeseries with latestTimeseries (prefer latest-based anchor; fill missing values from insights)
              const mergeTimeseriesByDay = (base, extra) => {
                const byDay = new Map(base.map(d => [d.day, { ...d }]));
                for (const row of extra) {
                  const cur = byDay.get(row.day) || {};
                  byDay.set(row.day, { ...row, ...cur });
                }
                return Array.from(byDay.values()).sort((a,b) => new Date(b.day) - new Date(a.day));
              };
              let mergedTs = mergeTimeseriesByDay(latestTimeseries, timeseries || []);
              mergedTs = await mergeAvgVitalsFromSleeps(mergedTs);
              // enrich mergedTs with previous-day stress values from health data
              try {
                mergedTs = await mergePrevStressFromHealth(mergedTs);
              } catch (e) {
                console.warn('Failed to merge prev_stress in enhanced comprehensive branch:', e);
              }

              const sleepAnalysis = {
                sleep_quality_metrics: {
                  avg_sleep_score: comp.temporal_patterns?.day_of_week_patterns ? 
                    Object.values(comp.temporal_patterns.day_of_week_patterns)
                      .filter(day => day.sleep_score)
                      .reduce((sum, day, _, arr) => sum + day.sleep_score.mean / arr.length, 0) : null,
                  total_sleep_sessions: comp.data_summary?.total_days || (mergedTs?.length || 0),
                  date_range: comp.data_summary?.date_range || `Last ${analysisParams.days} days`,
                  avg_deep_sleep_minutes: comp.sleep_quality?.avg_deep_sleep_minutes ?? null,
                  avg_rem_sleep_minutes: comp.sleep_quality?.avg_rem_sleep_minutes ?? null,
                },
                sleep_timing_analysis: comp.temporal_patterns || {},
                recommendations: comp.recommendations || [],
                timeseries: mergedTs,
              };

              setSleepData({
                ...data,
                sleep_analysis: sleepAnalysis,
                insights: { sleep: data.insights }
              });
              return;
        }
        
        // If sleep-specific response already contains sleep_analysis
        if (data.sleep_analysis) {
          const sa = data.sleep_analysis || {};
          let timeseries = Array.isArray(sa.timeseries) ? sa.timeseries : [];
          if (timeseries && timeseries.length) {
            timeseries = timeseries.map(r => {
              const n = normalizeTimeseriesRow(r || {});
              n.day = n.day || n.date;
              return n;
            });
          }
          if (!timeseries.length) {
            // try fallback health data for charts
            try {
              const health = await getHealthDataForRange(analysisParams.days);
                if (Array.isArray(health)) {
                timeseries = health.map(d => ({
                  day: d.day,
                  sleep_score: d.sleep_score,
                  sleep_duration_minutes: d.time_in_bed_minutes ?? (d.time_in_bed_seconds ? Math.round(Number(d.time_in_bed_seconds)/60) : null) ?? d.sleep_minutes ?? (d.sleep_seconds ? Math.round(Number(d.sleep_seconds)/60) : null) ?? null,
                  deep_sleep_minutes: d.deep_sleep_minutes ?? (d.deep_sleep_seconds ? Math.round(Number(d.deep_sleep_seconds)/60) : null) ?? null,
                  rem_sleep_minutes: d.rem_sleep_minutes ?? (d.rem_sleep_seconds ? Math.round(Number(d.rem_sleep_seconds)/60) : null) ?? null,
                  light_sleep_minutes: d.light_sleep_minutes ?? (d.light_sleep_seconds ? Math.round(Number(d.light_sleep_seconds)/60) : null) ?? null,
                  awake_minutes: d.awake_minutes ?? (d.awake_seconds ? Math.round(Number(d.awake_seconds)/60) : null) ?? null,
                  bedtime_minutes: d.bedtime_minutes ?? null,
                  wake_minutes: d.wake_minutes ?? null,
                  avg_sleep_hr: d.avg_sleep_hr ?? d.rhr ?? null,
                  rhr: d.avg_sleep_hr ?? d.rhr ?? null,
                  hrv_avg: d.hrv_avg ?? null,
                  avg_sleep_rr: d.avg_sleep_rr ?? d.respiratory_rate ?? null,
                  respiratory_rate: d.avg_sleep_rr ?? d.respiratory_rate ?? null,
                  avg_sleep_stress: d.avg_sleep_stress ?? d.stress_avg ?? null,
                  stress_avg: d.avg_sleep_stress ?? d.stress_avg ?? null,
                  steps: d.steps ?? null,
                  energy_level: d.energy_level ?? null,
                  mood: d.mood ?? null,
                }));
              }
            } catch (e) {
              console.warn('Fallback health data fetch (sleep_analysis path) failed:', e);
            }
          }
          // Merge sleep_analysis.timeseries with latestTimeseries
          const mergeTimeseriesByDay = (base, extra) => {
            const byDay = new Map(base.map(d => [d.day, { ...d }]));
            for (const row of extra) {
              const cur = byDay.get(row.day) || {};
              byDay.set(row.day, { ...row, ...cur });
            }
            return Array.from(byDay.values()).sort((a,b) => new Date(b.day) - new Date(a.day));
          };
          let mergedTs = mergeTimeseriesByDay(latestTimeseries, timeseries || []);
          // enrich mergedTs with avg_sleep_hr coming from garmin_sleep_sessions when missing
          try {
            const sleeps = await fetchLatestSleepsDirect();
            if (sleeps && sleeps.length) {
              const byDay = new Map(sleeps.map(s => [String(s.day), s]));
              mergedTs = mergedTs.map(row => {
                const dayKey = String(row?.day);
                const sleepRow = byDay.get(dayKey);
                if (!sleepRow) return row;
                const out = { ...row };
                if ((out.avg_sleep_hr == null || out.rhr == null) && sleepRow.avg_sleep_hr != null) {
                  out.avg_sleep_hr = sleepRow.avg_sleep_hr;
                  out.rhr = out.rhr ?? sleepRow.avg_sleep_hr;
                }
                if ((out.avg_sleep_rr == null || out.respiratory_rate == null) && (sleepRow.avg_sleep_rr != null || sleepRow.avg_respiration != null || sleepRow.respiratory_rate != null)) {
                  out.avg_sleep_rr = out.avg_sleep_rr ?? (sleepRow.avg_sleep_rr ?? sleepRow.avg_respiration ?? sleepRow.respiratory_rate ?? null);
                  out.respiratory_rate = out.respiratory_rate ?? out.avg_sleep_rr;
                }
                if ((out.avg_sleep_stress == null || out.stress_avg == null) && (sleepRow.avg_sleep_stress != null || sleepRow.stress_avg != null || sleepRow.stress != null)) {
                  out.avg_sleep_stress = out.avg_sleep_stress ?? (sleepRow.avg_sleep_stress ?? sleepRow.stress_avg ?? sleepRow.stress ?? null);
                  out.stress_avg = out.stress_avg ?? out.avg_sleep_stress;
                }
                return out;
              });
            }
          } catch (e) {
            console.warn('Failed to merge avg vitals for sleep_analysis branch:', e);
          }

            // enrich mergedTs with previous-day stress values from health data
            try {
              mergedTs = await mergePrevStressFromHealth(mergedTs);
            } catch (e) {
              console.warn('Failed to merge prev_stress in sleep_analysis branch:', e);
            }

          setSleepData({
            ...data,
            sleep_analysis: { ...sa, timeseries: mergedTs },
          });
          return;
        }

        // Fallback for other response formats
        if (data.insights && data.insights.error === 'No data available') {
          console.log('No sleep data available for the selected period');
          setSleepData({ 
            ...data, 
            message: 'No sleep data found for the selected period',
            dataGap: true 
          });
          return;
        }
        
        // As a final fallback, normalize arbitrary data into sleep_analysis structure
        try {
          let timeseries = Array.isArray(data?.timeseries) ? data.timeseries : [];
          if (!timeseries.length) {
            const health = await getHealthDataForRange(analysisParams.days);
            if (Array.isArray(health)) {
              timeseries = health.map(d => ({
                day: d.day,
                sleep_score: d.sleep_score,
                sleep_duration_minutes: d.time_in_bed_minutes ?? d.sleep_minutes ?? null,
                deep_sleep_minutes: d.deep_sleep_minutes ?? null,
                rem_sleep_minutes: d.rem_sleep_minutes ?? null,
                light_sleep_minutes: d.light_sleep_minutes ?? null,
                awake_minutes: d.awake_minutes ?? null,
                bedtime_minutes: d.bedtime_minutes ?? null,
                wake_minutes: d.wake_minutes ?? null,
                rhr: d.rhr ?? null,
                hrv_avg: d.hrv_avg ?? null,
                respiratory_rate: d.respiratory_rate ?? null,
                stress_avg: d.stress_avg ?? null,
                steps: d.steps ?? null,
                energy_level: d.energy_level ?? null,
                mood: d.mood ?? null,
              }));
            }
          }

          const avg = (arr) => {
            const xs = arr.map(Number).filter(v => !isNaN(v));
            return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
          };

          // Merge with latestTimeseries and compute metrics on merged
          const mergeTimeseriesByDay = (base, extra) => {
            const byDay = new Map(base.map(d => [d.day, { ...d }]));
            for (const row of extra) {
              const cur = byDay.get(row.day) || {};
              byDay.set(row.day, { ...row, ...cur });
            }
            return Array.from(byDay.values()).sort((a,b) => new Date(b.day) - new Date(a.day));
          };
          let mergedTs = mergeTimeseriesByDay(latestTimeseries, timeseries || []);
          try {
            mergedTs = await mergePrevStressFromHealth(mergedTs);
          } catch (e) {
            console.warn('Failed to merge prev_stress in fallback branch:', e);
          }

          const sleepAnalysis = {
            sleep_quality_metrics: {
              avg_sleep_score: avg(mergedTs.map(d => d.sleep_score)),
              total_sleep_sessions: mergedTs.length,
              date_range: `Last ${analysisParams.days} days`,
              avg_deep_sleep_minutes: avg(mergedTs.map(d => d.deep_sleep_minutes)),
              avg_rem_sleep_minutes: avg(mergedTs.map(d => d.rem_sleep_minutes)),
            },
            sleep_timing_analysis: {},
            recommendations: [],
            timeseries: mergedTs,
          };

          setSleepData({ ...data, sleep_analysis: sleepAnalysis });
        } catch (e) {
          console.warn('Normalization fallback failed:', e);
          setSleepData(data);
        }
      } else {
        console.warn('No data received from fetchSpecializedAnalysis');
        setSleepData({ 
          message: 'Failed to load sleep data',
          error: true 
        });
      }
    } catch (error) {
      console.error('Error in loadSleepAnalysis:', error);
      setLocalError(error.message || 'Failed to load sleep analysis');
      setSleepData({ 
        message: error.message || 'Failed to load sleep analysis',
        error: true 
      });
    } finally {
      setLocalLoading(false);
    }
  }, [analysisParams.days, fetchSpecializedAnalysis, getHealthDataForRange]);

  useEffect(() => {
    loadSleepAnalysis();
  }, [loadSleepAnalysis]);

  const handleParamsChange = useCallback((newParams) => {
    setAnalysisParams(prev => ({ ...prev, ...newParams }));
    try {
      if (newParams.days !== undefined) {
        localStorage.setItem('sleep_period_days', String(newParams.days));
      }
    } catch (e) {
      console.warn('Could not write to localStorage', e);
    }
  }, []);

  // Memoized derived data
  const analysis = sleepData?.sleep_analysis;
  const timeseries = useMemo(() => analysis?.timeseries || [], [analysis]);

  const timeseriesLimited = useMemo(() => {
    const sorted = [...timeseries].sort((a, b) => new Date(b.day) - new Date(a.day));
    return sorted.slice(0, analysisParams.days);
  }, [timeseries, analysisParams.days]);

  const computedAvgBedMin = useMemo(() => {
    if (analysis?.sleep_timing?.avg_bedtime_circular) return analysis.sleep_timing.avg_bedtime_circular;
    return circularMeanMinutes(timeseriesLimited.map(d => d?.bedtime_minutes));
  }, [analysis, timeseriesLimited]);

  const computedAvgWakeMin = useMemo(() => {
    if (analysis?.sleep_timing?.avg_wake_time_circular) return analysis.sleep_timing.avg_wake_time_circular;
    return circularMeanMinutes(timeseriesLimited.map(d => d?.wake_minutes));
  }, [analysis, timeseriesLimited]);

  const computedMedianBedMin = useMemo(() => {
    const arr = timeseriesLimited.map(d => d?.bedtime_minutes);
    const medSeries = circularRollingMedian(arr, 14);
    if (!medSeries || !medSeries.length) return null;
    return medSeries[medSeries.length - 1];
  }, [timeseriesLimited]);

  const computedMedianWakeMin = useMemo(() => {
    const arr = timeseriesLimited.map(d => d?.wake_minutes);
    const medSeries = circularRollingMedian(arr, 14);
    if (!medSeries || !medSeries.length) return null;
    return medSeries[medSeries.length - 1];
  }, [timeseriesLimited]);
  
  const recommendedBedCenter = useMemo(() => {
    if (analysis?.sleep_timing?.recommended_bedtime_minutes) return analysis.sleep_timing.recommended_bedtime_minutes;
    if (computedAvgWakeMin == null) return null;
    return (computedAvgWakeMin - RECOMMENDED_SLEEP_TARGET_MINUTES + 1440) % 1440;
  }, [analysis, computedAvgWakeMin]);

  const avgBedWindow = useMemo(() => windowAround(computedAvgBedMin, 30), [computedAvgBedMin]);
  const avgWakeWindow = useMemo(() => windowAround(computedAvgWakeMin, 30), [computedAvgWakeMin]);
  const recommendedBedWindow = useMemo(() => windowAround(recommendedBedCenter, 30), [recommendedBedCenter]);


  return {
    // Prefer local loading/error so this hook's UI isn't affected by global context fetches
    loading: localLoading,
    error: localError || ctxError,
    analysis,
    analysisParams,
    timeseriesLimited,
    handleParamsChange,
    handleRefresh: loadSleepAnalysis,
    derivedTiming: {
      computedAvgBedMin,
  computedMedianBedMin,
      computedAvgWakeMin,
  computedMedianWakeMin,
      recommendedBedCenter,
      avgBedWindow,
      avgWakeWindow,
      recommendedBedWindow,
      mmToHHMM,
    },
  };
};