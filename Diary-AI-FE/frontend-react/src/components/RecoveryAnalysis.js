import React, { useMemo, useState, useCallback } from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';
import { getSleepScoreColor } from '../utils/chartUtils';

/*
  RecoveryAnalysis - minimal clean version
  Shows:
    - Score gauge + quick stats
    - Component sparklines (if available)
    - Trend area (score + optional baseline)
    - Recommendations (if any)
    - Basic pattern details (summary + daily classification)
  Removed: verbose styling, duplicated legacy sections that caused prior corruption.
*/

const RecoveryAnalysis = ({ data, periodDays = null }) => {
  const [expanded, setExpanded] = useState(null); // { type: 'trend'|'component', key?:string }
  const [showHrvContext, setShowHrvContext] = useState(false);
  const [showAllDeviationEvents, setShowAllDeviationEvents] = useState(false);
  const closeExpanded = useCallback(()=> setExpanded(null), []);

  const analysis = data?.recovery_analysis || data;
  const state = useMemo(() => {
    if (!analysis || typeof analysis !== 'object') return null;
    return {
      score: analysis.current_recovery_score ?? analysis.currentScore ?? analysis.score ?? 0,
      trend: analysis.recovery_trend || analysis.trend || 'stable',
      best: analysis.best_recovery_score ?? analysis.bestScore ?? 0,
      worst: analysis.worst_recovery_score ?? analysis.worstScore ?? 0,
      consistency: analysis.recovery_consistency ?? analysis.consistency ?? 0,
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      pattern: analysis.pattern_details || {}
    };
  }, [analysis]);

  // Prefer full series if provided by backend for better historical coverage
  const rawFullTrend = analysis?.trend_series_full;
  const rawTailTrend = analysis?.trend_series;
  let trendSeries = [];
  if (Array.isArray(rawFullTrend) && rawFullTrend.length) {
    trendSeries = rawFullTrend;
  } else if (Array.isArray(rawTailTrend) && rawTailTrend.length) {
    trendSeries = rawTailTrend;
  } else if (Array.isArray(analysis?.component_trend_series_full) && analysis.component_trend_series_full.length) {
    trendSeries = analysis.component_trend_series_full.map(r => ({
      day: r.day,
      score: r.composite ?? (['rhr','hrv','sleep','stress','energy','vo2max','respiratory']
        .map(k=>r[k])
        .filter(v=>v!=null)
        .reduce((a,b)=>a+b,0) / (['rhr','hrv','sleep','stress','energy','vo2max','respiratory']
        .map(k=>r[k])
        .filter(v=>v!=null).length || 1))
    }));
  } else if (Array.isArray(analysis?.component_trend_series) && analysis.component_trend_series.length) {
    trendSeries = analysis.component_trend_series.map(r => ({
      day: r.day,
      score: r.composite ?? (['rhr','hrv','sleep','stress','energy','vo2max','respiratory']
        .map(k=>r[k])
        .filter(v=>v!=null)
        .reduce((a,b)=>a+b,0) / (['rhr','hrv','sleep','stress','energy','vo2max','respiratory']
        .map(k=>r[k])
        .filter(v=>v!=null).length || 1))
    }));
  } else if (Array.isArray(analysis?.pattern_details?.daily_classification) && analysis.pattern_details.daily_classification.length) {
    trendSeries = analysis.pattern_details.daily_classification.map(d => ({ day: d.day, score: d.recovery_score }));
  }

  const fullLen = Array.isArray(rawFullTrend) ? rawFullTrend.length : (Array.isArray(analysis?.trend_series_full) ? analysis.trend_series_full.length : 0);
  const tailLen = Array.isArray(rawTailTrend) ? rawTailTrend.length : (Array.isArray(analysis?.trend_series) ? analysis.trend_series.length : 0);
  const tailDays = analysis?.trend_tail_days;
  // Ensure boolean (avoid rendering raw 0 when tailLen is 0)
  const showingTailSubset = !!(fullLen && tailLen && tailLen < fullLen);

  // Compute a lightweight rolling baseline (7-day mean) if baseline missing
  const enrichedTrend = useMemo(()=>{
    if (!trendSeries || !trendSeries.length) return [];
    const arr = [...trendSeries].sort((a,b)=> (a.day > b.day ? 1 : -1));
    let rolling = [];
    return arr.map((row,i)=>{
      rolling.push(row.score);
      if (rolling.length > 7) rolling.shift();
      const baseline = rolling.reduce((a,b)=>a+b,0)/rolling.length;
      return { ...row, baseline: Math.round(baseline*10)/10 };
    });
  }, [trendSeries]);

  const componentTrend = (analysis?.component_trend_series_full && analysis.component_trend_series_full.length)
    ? analysis.component_trend_series_full
    : (analysis?.component_trend_series || []);
  // Normalize possible backend field naming: if hr_variability present but hrv absent, create hrv alias (ms-based value already scaled upstream to component 0-100 if appropriate)
  const componentTrendNormalized = useMemo(()=> {
    if(!Array.isArray(componentTrend)) return [];
    return componentTrend.map(r => {
      if(r==null || typeof r !== 'object') return r;
      if(r.hrv == null && r.hr_variability != null) {
        return { ...r, hrv: r.hr_variability };
      }
      return r;
    });
  }, [componentTrend]);
  const deviationEvents = analysis?.deviation_events || [];

  // Derive cutoff date for componentTrend based on periodDays similar to enrichedTrend
  const componentTrendFiltered = useMemo(()=> {
    if (!periodDays || periodDays <= 0) return componentTrend;
    if (!componentTrendNormalized || !componentTrendNormalized.length) return componentTrendNormalized;
    const sorted = [...componentTrendNormalized].sort((a,b)=> (a.day > b.day ? 1 : (a.day < b.day ? -1 : 0)));
    const last = sorted[sorted.length-1];
    const lastDate = parseDateObj(last?.day);
    if(!lastDate) return componentTrendNormalized;
    const cutoff = new Date(lastDate.getTime() - (periodDays-1)*86400000);
    return sorted.filter(r => {
      const d = parseDateObj(r.day); if(!d) return false; return d >= cutoff;
    });
  }, [componentTrendNormalized, periodDays]);

  // Simple icon mapping for deviation event types
  const deviationIcons = {
    hrv_drop: '💓',
    hrv_spike: '💗',
    sleep_debt: '😴',
    stress_spike: '⚡',
    rhr_elevated: '🔥',
    energy_drop: '🪫',
    respiratory_change: '🌬️',
    default: '🔍'
  };

  const sparkKeys = ['composite','rhr','hrv','sleep','stress','energy','vo2max','respiratory']
    .filter(k => componentTrendNormalized.some(r => r[k] != null));

  const label = (s) => s>=80?'Excellent':s>=60?'Good':s>=40?'Fair':s>=0?'Poor':'—';

  if (!state) {
    return <div style={styles.empty}>No recovery analysis data.</div>;
  }

  const formatDay = useCallback((raw) => {
    if (raw == null) return '';
    // Try parse date-like string YYYY-MM-DD else return raw
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return parseInt(raw.split('-')[2],10);
    }
    // If already number or short label
    const asNum = Number(raw);
    return Number.isFinite(asNum) ? asNum : raw;
  }, []);

  const normalizeDay = useCallback((val) => {
    if (val == null) return { dayLabel: '', dayNum: '' };
    if (typeof val === 'string') {
      // RFC 1123 / HTTP-date like: Wed, 04 Jun 2025 00:00:00 GMT
      const rfcMatch = /^([A-Za-z]{3}),\s(\d{2})\s([A-Za-z]{3})\s(\d{4})\s(\d{2}:\d{2}:\d{2})\sGMT$/.exec(val);
      if (rfcMatch) {
        const dayNum = parseInt(rfcMatch[2],10);
        return { dayLabel: val, dayNum };
      }
      // Strip time if ISO with time
      const pure = val.includes('T') ? val.split('T')[0] : val.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(pure)) {
        return { dayLabel: val, dayNum: parseInt(pure.split('-')[2],10) };
      }
    }
    const asNum = Number(val);
    if (Number.isFinite(asNum)) return { dayLabel: String(val), dayNum: asNum };
    return { dayLabel: String(val), dayNum: String(val) };
  }, []);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function parseDateObj(raw){
    if(!raw) return null;
    let d = null;
    if (typeof raw === 'string') {
      if (/^[A-Za-z]{3},/.test(raw)) { // RFC 1123
        const dt = new Date(raw);
        if (!isNaN(dt)) d = dt;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { // YYYY-MM-DD
        d = new Date(raw + 'T00:00:00Z');
      } else if (/^\d{4}-\d{2}-\d{2}\s/.test(raw)) { // YYYY-MM-DD HH:MM:SS
        d = new Date(raw.replace(' ', 'T') + 'Z');
      } else if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) { // ISO full
        const dt = new Date(raw);
        if (!isNaN(dt)) d = dt;
      }
    } else if (raw instanceof Date) {
      d = raw;
    }
    return d && !isNaN(d) ? d : null;
  }

  const formatFullWithWeekday = useCallback((raw) => {
    const d = parseDateObj(raw);
    if (!d) return raw;
    const wd = WEEKDAYS[d.getUTCDay()];
    const dayNum = String(d.getUTCDate()).padStart(2,'0');
    const mon = MONTHS[d.getUTCMonth()];
    const yr = d.getUTCFullYear();
    return `${wd} ${dayNum} ${mon} ${yr}`;
  }, []);

  // Chronological sort (full) for enriched trend
  const sortedEnrichedAll = useMemo(()=> {
    return [...enrichedTrend].sort((a,b)=>{
      const da = parseDateObj(a.day); const db = parseDateObj(b.day);
      if (da && db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return (a.day > b.day ? 1 : (a.day < b.day ? -1 : 0));
    });
  }, [enrichedTrend]);
  // Determine cutoff for selected periodDays (calendar days)
  const cutoffDate = useMemo(()=> {
    if (!periodDays || periodDays <= 0 || !sortedEnrichedAll.length) return null;
    const ds = sortedEnrichedAll.map(r => parseDateObj(r.day)).filter(Boolean);
    if (!ds.length) return null;
    const max = ds[ds.length-1];
    return new Date(max.getTime() - (periodDays-1)*24*3600*1000);
  }, [periodDays, sortedEnrichedAll]);
  const sortedEnriched = useMemo(()=> {
    if (!cutoffDate) return sortedEnrichedAll;
    return sortedEnrichedAll.filter(r => {
      const d = parseDateObj(r.day);
      return !d || d >= cutoffDate;
    });
  }, [sortedEnrichedAll, cutoffDate]);
  const preparedTrend = useMemo(()=> sortedEnriched.map((r,i) => {
    const d = parseDateObj(r.day);
    if(!d) return { ...r, dayIdx:i, dayLabel: r.day, fullDate: r.day, tickLabel: r.day };
    const dayNum = d.getUTCDate();
    const mon = MONTHS[d.getUTCMonth()];
    const yr = d.getUTCFullYear();
    // Build tick label strategy: just day number for dense ranges, include month on first day or sparse intervals
    const tickLabel = `${dayNum}` + (dayNum === 1 ? ` ${mon}` : '');
    return {
      ...r,
      dayIdx: i,
      weekday: WEEKDAYS[d.getUTCDay()],
      dayLabel: WEEKDAYS[d.getUTCDay()], // keep backward compatibility (weekday only)
      fullDate: `${String(dayNum).padStart(2,'0')} ${mon} ${yr}`,
      tickLabel
    };
  }), [sortedEnriched]);

  // Trend axis tick formatter (reduce clutter, avoid duplicate weekday spam)
  const trendTickFormatter = useCallback((valueIndex) => {
    const total = preparedTrend.length;
    const item = preparedTrend[valueIndex];
    if(!item) return '';
    // Dynamic interval based on total points
    const interval = total > 120 ? 14 : total > 80 ? 10 : total > 60 ? 7 : total > 40 ? 5 : total > 25 ? 3 : 1;
    if (valueIndex === 0 || valueIndex === total-1 || valueIndex % interval === 0) return item.tickLabel;
    return '';
  }, [preparedTrend]);

  // Period-aware display score (latest in window if window active)
  const displayScore = useMemo(()=> {
    if (preparedTrend.length) {
      const last = preparedTrend[preparedTrend.length-1];
      if (last?.score != null) return last.score;
    }
    return state?.score ?? 0;
  }, [preparedTrend, state]);

  // Derive simple window trend label based on start/end scores within window
  const windowTrendLabel = useMemo(()=> {
    if (preparedTrend.length >= 2) {
      const first = preparedTrend[0].score;
      const last = preparedTrend[preparedTrend.length-1].score;
      if (first!=null && last!=null) {
        const diff = last - first;
        if (Math.abs(diff) < 1.5) return 'stable';
        return diff > 0 ? 'improving' : 'declining';
      }
    }
    return state?.trend || 'stable';
  }, [preparedTrend, state]);

  const windowDelta = useMemo(()=> {
    if (preparedTrend.length >= 2) {
      const first = preparedTrend[0].score;
      const last = preparedTrend[preparedTrend.length-1].score;
      if (first!=null && last!=null) return last - first;
    }
    return null;
  }, [preparedTrend]);

  // Define recoveryWindowStats BEFORE gaugeValue to avoid temporal dead zone in its useMemo dependencies
  const recoveryWindowStats = useMemo(()=> {
    const src = preparedTrend;
    if (!src || !src.length) return { latest:null, best:null, worst:null, avg:null, delta:null, count:0 };
    let arr = src.map(r => r.score).filter(v=> v!=null && Number.isFinite(v));
    if (!arr.length) return { latest:null, best:null, worst:null, avg:null, delta:null, count:0 };
    const latest = arr[arr.length-1];
    const first = arr[0];
    const best = Math.max(...arr);
    const worst = Math.min(...arr);
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    const delta = latest - first;
    return { latest, best, worst, avg, delta, count:arr.length };
  }, [preparedTrend]);

  // Toggle: show average instead of latest in gauge (improves visible difference when switching long windows)
  const [useAvgGauge, setUseAvgGauge] = useState(false);
  const gaugeValue = useMemo(()=> {
    if (useAvgGauge && recoveryWindowStats.avg!=null) return recoveryWindowStats.avg;
    return displayScore;
  }, [useAvgGauge, recoveryWindowStats, displayScore]);

  // deviationEventsFiltered placed after cutoffDate definition to avoid temporal dead zone
  const deviationEventsFiltered = useMemo(()=>{
    if (!periodDays || periodDays <= 0 || !deviationEvents.length) return deviationEvents;
    if (cutoffDate) {
      return deviationEvents.filter(ev => {
        const d = parseDateObj(ev.day); if(!d) return false; return d >= cutoffDate; });
    }
    const dates = deviationEvents.map(ev=> parseDateObj(ev.day)).filter(Boolean).sort((a,b)=> a-b);
    if(!dates.length) return deviationEvents;
    const max = dates[dates.length-1];
    const localCut = new Date(max.getTime() - (periodDays-1)*86400000);
    return deviationEvents.filter(ev => { const d = parseDateObj(ev.day); return d && d >= localCut; });
  }, [deviationEvents, periodDays, cutoffDate]);

  // (recoveryWindowStats already defined earlier)

  // Component series sorting + slicing
  const sortedComponentAll = useMemo(()=> {
    return [...componentTrend].sort((a,b)=>{
      const da = parseDateObj(a.day); const db = parseDateObj(b.day);
      if (da && db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return (a.day > b.day ? 1 : (a.day < b.day ? -1 : 0));
    });
  }, [componentTrend]);
  const sortedComponent = useMemo(()=> {
    if (!cutoffDate) return sortedComponentAll;
    return sortedComponentAll.filter(r => {
      const d = parseDateObj(r.day);
      return !d || d >= cutoffDate;
    });
  }, [sortedComponentAll, cutoffDate]);
  const preparedComponentTrend = useMemo(()=> sortedComponent.map(r => {
    const d = parseDateObj(r.day);
    return { ...r, dayLabel: d ? `${WEEKDAYS[d.getUTCDay()]}` : r.day, fullDate: d ? formatFullWithWeekday(r.day) : r.day };
  }), [sortedComponent, formatFullWithWeekday]);

  const TrendTooltip = ({active,payload,label}) => {
    if(!active||!payload?.length) return null;
    const item = payload[0]?.payload;
    let displayDate = item?.day ? formatFullWithWeekday(item.day) : (item?.fullDate || item?.dayLabel || label);
    if (typeof displayDate === 'string') displayDate = displayDate.replace(/\s00:00:00 GMT$/, '');
    return (
      <div style={styles.ttBox}>
        <div style={styles.ttDate}>{displayDate}</div>
        {payload.filter(p=>p.dataKey==='score' || p.dataKey==='baseline').map(p => (
          <div key={p.dataKey} style={styles.ttRow}>
            <span>{p.dataKey==='score'?'Wynik':'Baseline'}</span>
            <span>{p.value!=null?Math.round(p.value):'—'}</span>
          </div>
        ))}
      </div>
    );
  };
  const SparkTooltip = ({active,payload}) => {
    if(!active||!payload?.length) return null;
    const row = payload[0].payload;
    let displayDate = row?.x ? formatFullWithWeekday(row.x) : (row.fullDate || row.x);
    if (typeof displayDate === 'string') displayDate = displayDate.replace(/\s00:00:00 GMT$/, '');
    return (
      <div style={styles.ttBox}>
        <div style={styles.ttDate}>{displayDate}</div>
        <div style={styles.ttRow}><span>Wynik</span><span>{Math.round(payload[0].value)}</span></div>
      </div>
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.grid}>
        {showingTailSubset && (
          <div style={styles.infoBanner}>
            <span style={{display:'block'}}>Pokazuję tail {tailLen}/{fullLen} (Tail={tailDays || tailLen}d).</span>
          </div>
        )}
        {/* Score + small stats */}
        <div style={styles.panel}>
          <h4 style={styles.h4}>Recovery Score</h4>
          <div style={styles.scoreLayout}> 
            <div style={styles.gaugeBlock}>
              <div style={styles.gauge}>
                <ResponsiveContainer>
                  <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ value: gaugeValue }]} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={10} fill={getSleepScoreColor(gaugeValue)} background clockWise />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div style={styles.gaugeCenter}>
                  <div style={styles.scoreVal}>{Math.round(gaugeValue)}</div>
                  <div style={styles.scoreLab}>{label(gaugeValue)}</div>
                </div>
              </div>
              <div style={styles.windowMetaRow}>
                {periodDays ? (
                  <>
                    <span style={styles.windowMetaChip}>{preparedTrend.length}d window</span>
                    {windowDelta!=null && <span style={styles.windowMetaChip}>Δ {windowDelta>0?'+':''}{Math.round(windowDelta)}</span>}
                    <button style={styles.windowToggleBtn} onClick={()=> setUseAvgGauge(s=>!s)}>
                      {useAvgGauge ? 'Show Latest' : 'Show Avg'}
                    </button>
                  </>
                ) : <span style={styles.windowMetaChip}>Full history</span>}
              </div>
              <div style={styles.primaryStatsRow}>
                {/* Period-based stats: best/worst/avg reflect filtered window; delta shows change over window */}
                {[
                  ['Trend', windowTrendLabel],
                  ['Avg', recoveryWindowStats.avg!=null? Math.round(recoveryWindowStats.avg):'—'],
                  ['Best', recoveryWindowStats.best!=null? Math.round(recoveryWindowStats.best):'—'],
                  ['Worst', recoveryWindowStats.worst!=null? Math.round(recoveryWindowStats.worst):'—']
                ].map(([k,v]) => (
                  <div key={k} style={styles.primaryStat}><span style={styles.primaryLabel}>{k}</span><span style={styles.primaryValue}>{v}</span></div>
                ))}
                {windowDelta!=null && (
                  <div style={styles.primaryStat}>
                    <span style={styles.primaryLabel}>Δ</span>
                    <span style={{...styles.primaryValue, color: windowDelta>0? '#16a34a' : (windowDelta<0? '#dc2626':'#f1f5f9')}}>{windowDelta>0? '+'+Math.round(windowDelta): Math.round(windowDelta)}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={styles.detailStatsColumn}>
              <div style={styles.detailHeader}>
                Core Signals Snapshot {periodDays? '(window)': '(full)'}
                <button style={styles.hrvCtxBtn} onClick={()=> setShowHrvContext(s=>!s)}>
                  {showHrvContext ? 'Hide raw HRV context' : 'Show raw HRV context'}
                </button>
              </div>
              <div style={styles.miniStatsGrid}>
                {['rhr','hrv','sleep','stress','energy','vo2max','respiratory']
                  .filter(key=> state.pattern?.summary || componentTrendFiltered.length)
                  .map(key => {
                    const base = periodDays ? componentTrendFiltered : componentTrend;
                    if (!base.length) return null;
                    const lastRow = base[base.length-1];
                    const latest = lastRow ? lastRow[key] : null;
                    if (latest == null) return null;
                    // Compute simple average over window when periodDays active
                    let avgVal = null;
                    if (periodDays && base.length) {
                      const vals = base.map(r=> r[key]).filter(v=> v!=null && Number.isFinite(v));
                      if (vals.length) avgVal = vals.reduce((a,b)=>a+b,0)/vals.length;
                    }
                    const isHRV = key === 'hrv';
                    let hrvExtra = null;
                    if (isHRV && showHrvContext) {
                      const raw = lastRow.hrv_raw;
                      const rawSm = lastRow.hrv_raw_smoothed;
                      const baseline = lastRow.hrv_baseline;
                      const cap = lastRow.hrv_cap;
                      const pctCap = (raw!=null && cap)? (raw/cap*100) : null;
                      const pctBase = (raw!=null && baseline)? (raw/baseline*100) : null;
                      const pctBaseSm = (rawSm!=null && baseline)? (rawSm/baseline*100) : null;
                      hrvExtra = (
                        <div style={styles.hrvContextBox}>
                          <div style={styles.hrvCtxRow}><span>Raw</span><span>{raw!=null? Math.round(raw): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>Raw(3d med)</span><span>{rawSm!=null? Math.round(rawSm): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>Baseline</span><span>{baseline!=null? Math.round(baseline): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>Cap</span><span>{cap!=null? Math.round(cap): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>%Cap</span><span>{pctCap!=null? Math.round(pctCap): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>%Baseline(raw)</span><span>{pctBase!=null? Math.round(pctBase): '—'}</span></div>
                          <div style={styles.hrvCtxRow}><span>%Baseline(3d)</span><span>{pctBaseSm!=null? Math.round(pctBaseSm): '—'}</span></div>
                          <div style={styles.hrvExplain}>
                            <strong>Explanation</strong><br/>
                            Raw = last nightly HRV reading (ms). Raw(3d med) = 3-day rolling median (noise reduction).<br/>
                            Baseline = adaptive 14-day rolling median (recent physiology).<br/>
                            Cap = performance ceiling (max of percentile, baseline*1.2, EMA*1.15) for scaling the 0–100 component.<br/>
                            %Cap shows how close raw is to your current ceiling.<br/>
                            %Baseline(raw) vs %Baseline(3d) — smoothed helps filter single-night anomalies.<br/>
                            Values well below baseline may indicate fatigue / high sympathetic load; sustained elevations can signal readiness or recovery rebound.
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} style={styles.metricChip} title={key==='hrv' && (lastRow?.hrv_raw!=null || lastRow?.hrv_raw_smoothed!=null) ? `HRV raw ${lastRow.hrv_raw!=null?Math.round(lastRow.hrv_raw):'—'}${lastRow.hrv_raw_smoothed!=null?` (3d ${Math.round(lastRow.hrv_raw_smoothed)})`:''} | baseline ${lastRow.hrv_baseline!=null?Math.round(lastRow.hrv_baseline):'—'} | cap ${lastRow.hrv_cap!=null?Math.round(lastRow.hrv_cap):'—'}`: undefined}>
                        <span style={styles.metricLabel}>
                          {key}
                          {isHRV && (
                            <span style={styles.hrvInfoWrapper} data-hrv-info>
                              <span style={styles.hrvInfoIcon}>ℹ</span>
                              <span style={styles.hrvInfoTip} className="hrvInfoTip">
                                <strong>HRV Scoring</strong><br/>
                                Baseline = adaptive rolling median of prior days (up to 14).<br/>
                                Cap = dynamic upper reference (max of 75th percentile, baseline*1.2, or EMA*1.15).<br/>
                                Component = (raw / cap)^0.7 * 100 (clamped 0–100).<br/>
                                Raw below baseline may signal strain; raw near cap indicates peak parasympathetic readiness.
                              </span>
                            </span>
                          )}
                        </span>
                        <span style={styles.metricValue}>{Math.round(latest)}</span>
                        {avgVal!=null && (
                          <span style={{...styles.metricValue, opacity:.65}}>avg {Math.round(avgVal)}</span>
                        )}
                        {hrvExtra}
                      </div>
                    );
                  })}
              </div>
              {sparkKeys.length>0 && (
                <div style={styles.sparkSection}>
                  <div style={styles.sparkHeaderRow}>
                    <span style={styles.sparkHeader}>Component Trends {periodDays?`(${periodDays}d)`:'(full)'}</span>
                  </div>
                  <div style={styles.sparksLarge}>
                    {sparkKeys.map(key => {
                      const base = componentTrendFiltered;
                      const series = base
                        .map(r => ({ x:r.day, y:r[key] }))
                        .sort((a,b)=> {
                          const da = parseDateObj(a.x); const db = parseDateObj(b.x);
                          if (da && db) return da - db;
                          if (da && !db) return -1;
                          if (!da && db) return 1;
                          return a.x > b.x ? 1 : (a.x < b.x ? -1 : 0);
                        });
                      return (
                        <div key={key} style={styles.sparkCardLarge} onClick={()=> setExpanded({type:'component', key})}>
                          <div style={styles.sparkTitleLarge}>{key}</div>
                          <div style={styles.sparkChartWrapLarge}>
                            <ResponsiveContainer>
                              <LineChart data={series} margin={{left:0,right:0,top:4,bottom:2}}>
                                <XAxis hide dataKey="x" />
                                <YAxis hide domain={[0,100]} />
                                <Tooltip content={<SparkTooltip />} />
                                <Line dataKey="y" type="monotone" stroke="#60a5fa" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div style={styles.sparkFooterLarge}>
                            <span>{series.length?Math.round(series[0].y||0):'—'}</span>
                            <span>{series.length?Math.round(series[series.length-1].y||0):'—'}</span>
                          </div>
                          <div style={styles.expandMini}>⤢</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trend */}
        <div style={styles.panel}>
          <h4 style={styles.h4}>Recovery Trend</h4>
          {enrichedTrend.length>1 ? (
            <div style={styles.clickableChartWrapper} onClick={() => setExpanded({type:'trend'})}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={preparedTrend} margin={{left:0,right:0,top:8,bottom:0}}>
                  <defs>
                    <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a4a5d" />
                  <XAxis dataKey="dayIdx" tickFormatter={(v,i)=> trendTickFormatter(i)} interval={0} tick={{fontSize:11, fill:'#cbd5e1'}} />
                  <YAxis domain={[0,100]} tick={{fontSize:11, fill:'#cbd5e1'}} />
                  <Tooltip content={<TrendTooltip />} />
                  <Area dataKey="score" type="monotone" stroke="#3b82f6" strokeWidth={2} fill="url(#gradScore)" />
                  {enrichedTrend.some(r=>r.baseline!=null) && (
                    <Line dataKey="baseline" type="monotone" stroke="#94a3b8" strokeWidth={1.1} dot={false} strokeDasharray="4 4" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              <div style={styles.expandHint}>Kliknij aby powiększyć</div>
            </div>
          ) : <div style={styles.placeholder}>No trend data (received: trend_series={analysis?.trend_series?.length||0}, component_trend_series={analysis?.component_trend_series?.length||0}).</div>}
        </div>

        {/* Recommendations */}
        {state.recommendations.length>0 && (
          <div style={styles.panel}>
            <h4 style={styles.h4}>Recommendations</h4>
            <div style={styles.recs}>
              {state.recommendations.map((rec,i)=> (
                <div key={i} style={styles.recItem}>
                  <span style={styles.recIcon}>💡</span>
                  <span style={styles.recText}>{rec}</span>
                  <span style={styles.recPrio}>{i===0?'High':i===1?'Medium':'Low'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deviation Events (recent) */}
        {deviationEventsFiltered.length>0 && (
          <div style={styles.panel}>
            <h4 style={styles.h4}>Recent Deviation Events</h4>
            <div style={styles.eventsMetaRow}>
              <span style={styles.eventsCount}>{deviationEventsFiltered.length} in window</span>
              {deviationEventsFiltered.length>6 && (
                <button style={styles.toggleBtn} onClick={()=> setShowAllDeviationEvents(s=>!s)}>{showAllDeviationEvents? 'Show less':'Show all'}</button>
              )}
            </div>
            {deviationEventsFiltered.length>1 && (
              <div style={styles.eventsSparklineBox}>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={deviationEventsFiltered.slice().sort((a,b)=> a.day > b.day ? 1 : -1)} margin={{left:0,right:0,top:4,bottom:0}}>
                    <defs>
                      <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis hide dataKey="day" />
                    <YAxis hide />
                    <Area type="monotone" dataKey="magnitude" stroke="#f59e0b" strokeWidth={1.2} fill="url(#evGrad)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul style={styles.eventsList}>
              {(() => {
                // Always start from full filtered list, sort descending, then slice if needed
                const sortedDesc = deviationEventsFiltered.slice().sort((a,b)=>{
                  const da = parseDateObj(a.day); const db = parseDateObj(b.day);
                  if(da && db) return db - da; // newest first
                  if(da && !db) return -1;
                  if(!da && db) return 1;
                  return a.day > b.day ? -1 : a.day < b.day ? 1 : 0;
                });
                const base = showAllDeviationEvents ? sortedDesc : sortedDesc.slice(0,6);
                return base.map((ev,i)=>{
                const dFmt = formatFullWithWeekday(ev.day);
                const sev = ev.magnitude!=null ? Math.abs(ev.magnitude) : 0;
                let badgeColor = '#475569';
                if(sev >= 25) badgeColor = '#dc2626';
                else if(sev >= 15) badgeColor = '#f59e0b';
                else if(sev >= 8) badgeColor = '#0ea5e9';
                const badgeStyle = { background: badgeColor, color:'#fff', borderRadius:12, padding:'2px 8px', fontSize:'0.55rem', fontWeight:600, letterSpacing:'.5px' };
                const icon = deviationIcons[ev.type] || deviationIcons.default;
                return (
                  <li key={i} style={styles.eventRow}>
                    <div style={styles.eventLineTop}>
                      <span style={styles.eventIcon}>{icon}</span>
                      <span style={styles.eventType}>{ev.type.replace(/_/g,' ')}</span>
                      <span style={styles.eventDate}>{dFmt}</span>
                      {ev.magnitude!=null && <span style={badgeStyle}>{ev.magnitude}%</span>}
                    </div>
                    {ev.note && <div style={styles.eventNote}>{ev.note}</div>}
                  </li>
                );
              }); })()}
            </ul>
          </div>
        )}

        {/* Pattern summary & daily table */}
        {state.pattern && (state.pattern.summary || state.pattern.daily_classification) && (
          <div style={styles.panel}>
            <h4 style={styles.h4}>Pattern Summary {periodDays?`(${periodDays}d)`:'(full)'}</h4>
            {state.pattern.summary && (
              <div style={styles.summaryBox}>
                {Object.entries(state.pattern.summary).map(([k,v])=> v!=null && (
                  <div key={k} style={styles.summaryItem}>
                    <span style={styles.summaryKey}>{k.replace(/_/g,' ')}:</span>
                    <span style={styles.summaryVal}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(state.pattern.daily_classification) && state.pattern.daily_classification.length>0 && (()=>{
              // Filter classification to the selected periodDays (most recent window)
              const cls = state.pattern.daily_classification
                .slice() // copy
                .sort((a,b)=> {
                  const da = parseDateObj(a.day); const db = parseDateObj(b.day); if(da && db) return da - db; return a.day.localeCompare(b.day);
                });
              const recent = periodDays && periodDays>0 ? cls.slice(-Math.min(periodDays, cls.length)) : cls; // last N days or full
              // Decide table size based on selected window (show full window but cap for very large periods)
              const cap = periodDays <= 30 ? periodDays : (periodDays <= 60 ? 45 : 60); // soft caps to keep UI usable
              const windowed = recent.slice(-cap);
              const rows = windowed.slice().reverse(); // newest first in UI
              return (
                <div style={{marginTop:12}}>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}> 
                      <thead>
                        <tr><th style={styles.th}>Day</th><th style={styles.th}>Score</th><th style={styles.th}>Δ</th><th style={styles.th}>Class</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((d,idx) => {
                          const prev = rows[idx+1]; // because reversed (next index is previous day chronologically)
                          let arrow = '→';
                          let color = '#94a3b8';
                          if(prev){
                            const diff = d.recovery_score - prev.recovery_score;
                            if(diff > 2){ arrow = '↗'; color = '#16a34a'; }
                            else if(diff < -2){ arrow = '↘'; color = '#dc2626'; }
                          }
                          return (
                            <tr key={d.day} style={styles.tr}>
                              <td style={styles.td}>{d.day}</td>
                              <td style={styles.td}>{d.recovery_score}</td>
                              <td style={styles.td}><span style={{color, fontWeight:600}}>{arrow}</span></td>
                              <td style={styles.td}>{d.classification.replace('_',' ')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {expanded && (
        <div style={styles.overlay} onClick={closeExpanded}>
          <div style={styles.modal} onClick={e=>e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{expanded.type === 'trend' ? 'Recovery Trend (Expanded)' : `Component Trend: ${expanded.key}`}</div>
              <button style={styles.closeBtn} onClick={closeExpanded}>✕</button>
            </div>
            <div style={styles.modalBody}>
              {expanded.type === 'trend' && (
                <ResponsiveContainer width="100%" height={420}>
                  <AreaChart data={preparedTrend} margin={{left:10,right:20,top:20,bottom:10}}>
                    <defs>
                      <linearGradient id="gradScoreBig" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a4a5d" />
                    <XAxis dataKey="dayIdx" tickFormatter={(v,i)=> trendTickFormatter(i)} interval={0} tick={{fontSize:12, fill:'#cbd5e1'}} />
                    <YAxis domain={[0,100]} tick={{fontSize:12, fill:'#cbd5e1'}} />
                    <Tooltip content={<TrendTooltip />} />
                    <Area dataKey="score" type="monotone" stroke="#3b82f6" strokeWidth={2.4} fill="url(#gradScoreBig)" />
                    {enrichedTrend.some(r=>r.baseline!=null) && (
                      <Line dataKey="baseline" type="monotone" stroke="#94a3b8" strokeWidth={1.3} dot={false} strokeDasharray="4 4" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {expanded.type === 'component' && expanded.key && (
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={componentTrendFiltered.map((r,i)=> { const d = parseDateObj(r.day); const dayNum = d? d.getUTCDate(): null; const mon = d? MONTHS[d.getUTCMonth()]:null; return { dayIdx:i, tickLabel: d? `${dayNum}${dayNum===1? ' '+mon:''}`: r.day, value:r[expanded.key], fullDate:r.day, raw:r.day }; })} margin={{left:10,right:20,top:20,bottom:10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a4a5d" />
                    <XAxis dataKey="dayIdx" tickFormatter={(v,i,vals)=> { const data = componentTrendFiltered; const total = data.length; const interval = total>120?14: total>80?10: total>60?7: total>40?5: total>25?3:1; if (i===0|| i===total-1 || i%interval===0){ const row = componentTrendFiltered[i]; const d = parseDateObj(row.day); if (!d) return row.day; const dn = d.getUTCDate(); const mon = MONTHS[d.getUTCMonth()]; return `${dn}${dn===1?' '+mon:''}`;} return ''; }} interval={0} tick={{fontSize:12, fill:'#cbd5e1'}} />
                    <YAxis domain={[0,100]} tick={{fontSize:12, fill:'#cbd5e1'}} />
                    <Tooltip content={<SparkTooltip />} />
                    <Line dataKey="value" type="monotone" stroke="#60a5fa" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Inline style objects to avoid external / corrupted CSS blocks */
const styles = {
  wrapper: { display:'flex', flexDirection:'column', gap:32, maxWidth:960, margin:'0 auto', padding:'18px 20px 70px', background:'linear-gradient(180deg,#1e2531 0%, #1b2230 55%, #181f2b 100%)', borderRadius:28 },
  infoBanner: { background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.5)', padding:'8px 12px', borderRadius:12, fontSize:'0.65rem', lineHeight:1.4, color:'#bfdbfe', letterSpacing:'.4px' },
  grid: { display:'flex', flexDirection:'column', gap:28 },
  panel: { background:'#253140', border:'1px solid #314255', boxShadow:'0 4px 16px -4px rgba(0,0,0,0.55), 0 2px 6px -1px rgba(0,0,0,0.35)', borderRadius:20, padding:'22px 26px', display:'flex', flexDirection:'column', gap:16, position:'relative' },
  h4: { margin:0, fontSize:'0.95rem', letterSpacing:'.5px', fontWeight:600, color:'#f1f5f9' },
  empty: { padding:44, textAlign:'center', color:'#94a3b8' },
  scoreLayout: { display:'flex', flexDirection:'row', gap:40, flexWrap:'wrap' },
  gaugeBlock: { display:'flex', flexDirection:'column', gap:24, alignItems:'center' },
  gauge: { width:300, height:300, position:'relative', flex:'0 0 auto', background:'radial-gradient(circle at 60% 40%, #324253 0%, #273542 100%)', borderRadius:'50%', boxShadow:'inset 0 2px 10px rgba(0,0,0,0.55)' },
  gaugeCenter: { position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' },
  scoreVal: { fontSize:'2.8rem', fontWeight:700, color:'#fafcff', textShadow:'0 1px 2px rgba(0,0,0,0.5)' },
  scoreLab: { fontSize:'0.75rem', fontWeight:600, opacity:.75, letterSpacing:'.5px', textTransform:'uppercase', color:'#cbd5e1' },
  primaryStatsRow: { display:'grid', gridTemplateColumns:'repeat(2,minmax(120px,1fr))', gap:14, width:'100%' },
  windowMetaRow: { marginTop:10, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' },
  windowMetaChip: { background:'#2f3d4c', border:'1px solid #3e4e5f', padding:'4px 10px', borderRadius:20, fontSize:'0.55rem', letterSpacing:'.5px', color:'#cbd5e1', fontWeight:600 },
  windowToggleBtn: { background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', fontSize:'0.55rem', padding:'4px 10px', borderRadius:16, cursor:'pointer', letterSpacing:'.5px' },
  primaryStat: { background:'#2f3d4c', border:'1px solid #3e4e5f', padding:'12px 14px', borderRadius:12, display:'flex', flexDirection:'column', gap:6 },
  primaryLabel: { fontSize:'0.65rem', letterSpacing:'.5px', textTransform:'uppercase', color:'#93a3b5', fontWeight:600 },
  primaryValue: { fontSize:'0.95rem', fontWeight:600, color:'#f1f5f9' },
  detailStatsColumn: { flex:1, minWidth:380, display:'flex', flexDirection:'column', gap:22 },
  detailHeader: { fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'.6px', fontWeight:700, color:'#cbd5e1', opacity:.9, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' },
  hrvCtxBtn: { background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', fontSize:'0.55rem', padding:'4px 10px', borderRadius:16, cursor:'pointer', letterSpacing:'.5px', fontWeight:600 },
  miniStatsGrid: { display:'flex', flexWrap:'wrap', gap:10 },
  metricChip: { background:'#2e3a47', border:'1px solid #3b4a5d', borderRadius:20, padding:'6px 12px', display:'flex', gap:6, alignItems:'center', position:'relative' },
  hrvContextBox: { display:'flex', flexDirection:'column', gap:2, position:'absolute', top:'100%', left:0, marginTop:6, background:'#1e2531', border:'1px solid #36485a', borderRadius:10, padding:'8px 10px', fontSize:'0.55rem', minWidth:130, zIndex:40, boxShadow:'0 6px 18px -4px rgba(0,0,0,0.55)' },
  hrvCtxRow: { display:'flex', justifyContent:'space-between', gap:10, color:'#f1f5f9' },
  hrvExplain: { marginTop:6, lineHeight:1.35, color:'#e2e8f0', fontSize:'0.5rem', borderTop:'1px solid #2d3a48', paddingTop:6, letterSpacing:'.3px' },
  hrvInfoWrapper: { position:'relative', display:'inline-block', marginLeft:4 },
  hrvInfoIcon: { fontSize:'0.55rem', background:'#1e293b', color:'#60a5fa', border:'1px solid #334155', borderRadius:'50%', width:14, height:14, lineHeight:'12px', display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'default' },
  hrvInfoTip: { position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', marginTop:6, background:'#101826', color:'#f1f5f9', border:'1px solid #1e2d3b', padding:'10px 12px', borderRadius:10, fontSize:'0.55rem', width:240, lineHeight:1.4, letterSpacing:'.3px', boxShadow:'0 6px 18px -4px rgba(0,0,0,0.6)', zIndex:60, opacity:0, pointerEvents:'none', transition:'opacity .18s ease' },
  metricLabel: { fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'.5px', color:'#93a3b5' },
  metricValue: { fontSize:'0.75rem', fontWeight:600, color:'#f1f5f9' },
  sparkSection: { display:'flex', flexDirection:'column', gap:14 },
  sparkHeaderRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  sparkHeader: { fontSize:'0.65rem', fontWeight:600, letterSpacing:'.6px', textTransform:'uppercase', color:'#a7b5c4' },
  sparksLarge: { display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))' },
  sparkCardLarge: { background:'#2b3948', border:'1px solid #3a4a5d', borderRadius:14, padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 },
  sparkTitleLarge: { fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'.6px', fontWeight:600, color:'#93a3b5' },
  sparkChartWrapLarge: { height:90 },
  sparkFooterLarge: { fontSize:'0.55rem', display:'flex', justifyContent:'space-between', color:'#cbd5e1', marginTop:2 },
  placeholder: { padding:18, background:'#2d3a49', border:'1px dashed #475869', borderRadius:14, fontSize:'0.72rem', color:'#93a3b5' },
  recs: { display:'flex', flexDirection:'column', gap:14 },
  recItem: { background:'#2b3948', border:'1px solid #3a4a5d', padding:'14px 16px', borderRadius:14, display:'flex', gap:14, alignItems:'flex-start', fontSize:'0.78rem', lineHeight:1.5, position:'relative', color:'#f1f5f9' },
  recIcon: { fontSize:'1.15rem' },
  recText: { flex:1, lineHeight:1.5, color:'#f1f5f9' },
  recPrio: { fontSize:'0.58rem', opacity:.75, alignSelf:'center', fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'#a7b5c4' },
  eventsMetaRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  eventsCount: { fontSize:'0.55rem', textTransform:'uppercase', letterSpacing:'.6px', color:'#94a3b8', fontWeight:600 },
  toggleBtn: { background:'#1e293b', border:'1px solid #334155', color:'#cbd5e1', fontSize:'0.6rem', padding:'4px 10px', borderRadius:16, cursor:'pointer', letterSpacing:'.5px' },
  eventLineTop: { display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' },
  eventType: { fontSize:'0.65rem', fontWeight:600, letterSpacing:'.5px', textTransform:'uppercase', color:'#f1f5f9' },
  eventIcon: { fontSize:'0.85rem', opacity:.9 },
  eventDate: { fontSize:'0.6rem', color:'#94a3b8' },
  eventNote: { fontSize:'0.6rem', marginTop:4, color:'#e2e8f0', lineHeight:1.3 },
  eventsSparklineBox: { width:'100%', height:60, marginBottom:8, background:'#1e2935', border:'1px solid #2d3a48', borderRadius:10, padding:'4px 6px' },
  eventsList: { listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:10, fontSize:'0.72rem' },
  eventRow: { background:'#2b3948', border:'1px solid #3a4a5d', borderRadius:10, padding:'10px 12px', color:'#f1f5f9' },
  summaryBox: { display:'flex', flexWrap:'wrap', gap:10, fontSize:'0.66rem' },
  summaryItem: { background:'#2b3948', border:'1px solid #3a4a5d', borderRadius:10, padding:'6px 10px', display:'flex', gap:6, alignItems:'center', color:'#f1f5f9' },
  summaryKey: { opacity:.7, textTransform:'capitalize', color:'#a7b5c4' },
  summaryVal: { fontWeight:600, color:'#f8fafc' },
  tableWrap: { maxHeight:260, overflow:'auto', border:'1px solid #3a4a5d', borderRadius:12, background:'#23303e' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:'0.7rem' },
  th: { textAlign:'left', padding:'8px 10px', background:'#31404f', position:'sticky', top:0, fontWeight:600, fontSize:'0.65rem', letterSpacing:'.5px', color:'#f1f5f9', boxShadow:'0 1px 0 #3a4a5d' },
  tr: {},
  td: { padding:'6px 10px', borderTop:'1px solid #3a4a5d', color:'#e2e8f0', background:'#253140' },
  ttBox: { background:'#101826', color:'#f1f5f9', padding:'8px 10px', borderRadius:8, fontSize:'0.66rem', boxShadow:'0 6px 18px -4px rgba(0,0,0,.65)', border:'1px solid #1e293b' },
  ttRow: { display:'flex', justifyContent:'space-between', gap:10 },
  ttDate: { fontWeight:600, marginBottom:6, fontSize:'0.7rem', letterSpacing:'.4px', color:'#f1f5f9' },
  clickableChartWrapper: { position:'relative', cursor:'pointer' },
  expandHint: { position:'absolute', bottom:8, right:12, fontSize:'0.55rem', letterSpacing:'.5px', textTransform:'uppercase', background:'rgba(0,0,0,0.35)', padding:'4px 6px', borderRadius:6, color:'#e2e8f0' },
  expandMini: { position:'absolute', top:6, right:6, fontSize:'0.65rem', opacity:.65 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 30px', zIndex:9999 },
  modal: { background:'#253140', border:'1px solid #324457', borderRadius:22, width:'min(1100px,100%)', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 10px 40px -5px rgba(0,0,0,0.6)' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid #324457' },
  modalTitle: { fontSize:'0.8rem', fontWeight:600, letterSpacing:'.7px', textTransform:'uppercase', color:'#f1f5f9' },
  closeBtn: { background:'none', border:'1px solid #3a4a5d', color:'#f1f5f9', borderRadius:8, cursor:'pointer', width:36, height:32, fontSize:'0.9rem' },
  modalBody: { padding:'20px 24px', flex:1, display:'flex' }
};

// Inject a tiny style tag for hover behavior (inline solution without external CSS file)
if (typeof document !== 'undefined' && !document.getElementById('hrv-info-hover-style')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'hrv-info-hover-style';
  styleEl.innerHTML = `
    [data-hrv-info] .hrvInfoTip { opacity:0; }
    [data-hrv-info]:hover .hrvInfoTip { opacity:1; pointer-events:auto; }
  `;
  document.head.appendChild(styleEl);
}

export default RecoveryAnalysis;