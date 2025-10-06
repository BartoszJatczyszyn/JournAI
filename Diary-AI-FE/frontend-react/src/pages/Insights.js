import React, { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { insightsAPI, healthAPI2 } from '../services';
import HealthTrendsCard from '../components/dashboard/HealthTrendsCard';
import MetricCard from '../components/MetricCard';
import HealthChart from '../components/HealthChart';
import SleepRecommendations from '../components/sleep/SleepRecommendations';
import HealthReport from '../components/ai/HealthReport';

const fmtNumber = (n) => {
  if (n == null || n === '') return '-';
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString();
};

const Insights = () => {
  const [daysRange, setDaysRange] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [healthData, setHealthData] = useState([]);
  const [personalized, setPersonalized] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('sleep_score');

  const decideChartProps = (metric) => {
    if (metric === 'steps' || metric === 'calories_total') return { type: 'bar' };
    if (metric === 'rhr') return { type: 'line', rollingWindow: 7 };
    if (metric === 'stress_avg') return { type: 'line', rollingWindow: 7 };
    if (metric === 'sleep_score') return { type: 'line', rollingWindow: 5 };
    return { type: 'line' };
  };

  const chartProps = decideChartProps(selectedMetric);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [hResp, pResp] = await Promise.all([
          healthAPI2.getHealthData(daysRange).catch(_err => { throw new Error('Failed to load health data: ' + (_err.message||_err)); }),
          insightsAPI.getPersonalized(daysRange).catch(() => null),
        ]);

        const hd = Array.isArray(hResp) ? hResp : (hResp?.data || []);
        setHealthData(hd || []);

        // Try to normalize personalized insights result to common shape
        const p = pResp || null;
        setPersonalized(p);

        // Fire-and-forget optimization for selected metric (best-effort)
        try {
          const opt = await insightsAPI.getOptimization(daysRange, selectedMetric).catch(() => null);
          setOptimization(opt || null);
        } catch (e) {
          setOptimization(null);
        }

      } catch (e) {
        console.error('Insights load failed', e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [daysRange, selectedMetric]);

  const metrics = useMemo(() => {
    const sorted = [...(healthData || [])].sort((a,b) => new Date(String(a.day)) - new Date(String(b.day)));
    const extract = (key) => sorted.map(r => (r == null || r[key] == null) ? null : Number(r[key]));

    const calc = (arr) => {
      const cleaned = arr.filter(v => v != null && !Number.isNaN(v));
      if (!cleaned.length) return { last: null, change: 0 };
      const last = cleaned[cleaned.length-1];
      const half = Math.max(1, Math.floor(cleaned.length/2));
      const recent = cleaned.slice(-half);
      const prev = cleaned.slice(0, Math.max(0, cleaned.length - half));
      const avg = a => a.reduce((s,x)=>s+x,0)/a.length;
      const recentAvg = avg(recent);
      const prevAvg = prev.length ? avg(prev) : recentAvg;
      const change = prevAvg ? ((recentAvg - prevAvg)/Math.abs(prevAvg))*100 : 0;
      return { last, change };
    };

    return {
      sleep: calc(extract('sleep_score')),
      steps: calc(extract('steps')),
      rhr: calc(extract('rhr')),
      recovery: calc(extract('recovery_score')),
      rawSeries: {
        sleepSeries: extract('sleep_score'),
        stepsSeries: extract('steps'),
        rhrSeries: extract('rhr'),
      }
    };
  }, [healthData]);

  const keyInsights = useMemo(() => {
    if (!personalized) return [];
    // accept multiple shapes: array of strings, object with insights[], or object with items
    if (Array.isArray(personalized)) return personalized.slice(0,6);
    // If insights is an object (detailed structured response), extract meaningful messages
    if (personalized.insights && typeof personalized.insights === 'object' && !Array.isArray(personalized.insights)) {
      const ins = personalized.insights;
      const msgs = [];
      if (ins.highlights) {
        if (Array.isArray(ins.highlights)) msgs.push(...ins.highlights.map(h => (typeof h === 'string' ? h : JSON.stringify(h))));
        else msgs.push(typeof ins.highlights === 'string' ? ins.highlights : JSON.stringify(ins.highlights));
      }
      if (ins.top_correlations) {
        if (Array.isArray(ins.top_correlations) && ins.top_correlations.length) {
          msgs.push('Top correlations detected — check Correlations section for details.');
        }
      }
      if (ins.recovery_trend && Array.isArray(ins.recovery_trend) && ins.recovery_trend.length) {
        msgs.push('Recovery trend data available — consider reviewing recent recovery scores for patterns.');
      }
      if (ins.sleep_focus) msgs.push(typeof ins.sleep_focus === 'string' ? ins.sleep_focus : JSON.stringify(ins.sleep_focus));
      if (ins.stress_focus) msgs.push(typeof ins.stress_focus === 'string' ? ins.stress_focus : JSON.stringify(ins.stress_focus));

      if (msgs.length) return msgs.slice(0,6);

      // nothing meaningful inside insights object
      return [`No significant personalized insights found for the last ${personalized.period_days || daysRange} days. Consider generating an AI report to get more actionable suggestions.`];
    }

    if (personalized.insights && Array.isArray(personalized.insights)) return personalized.insights.slice(0,6);
    if (personalized.recommendations && Array.isArray(personalized.recommendations)) return personalized.recommendations.slice(0,6);
    if (personalized.items && Array.isArray(personalized.items)) return personalized.items.slice(0,6);
    // fallback: try to extract string fields
    return [personalized.message || personalized.summary || JSON.stringify(personalized)].slice(0,6);
  }, [personalized, daysRange]);

  const recommendationsList = useMemo(() => {
    if (!personalized) return [];
    if (Array.isArray(personalized)) return personalized.filter(i => typeof i === 'string');
    if (personalized.recommendations && Array.isArray(personalized.recommendations)) return personalized.recommendations;
    if (personalized.actions && Array.isArray(personalized.actions)) return personalized.actions.map(a => typeof a === 'string' ? a : (a.text || JSON.stringify(a)));
    if (personalized.items && Array.isArray(personalized.items)) return personalized.items.map(i => typeof i === 'string' ? i : (i.text || JSON.stringify(i)));
    return [];
  }, [personalized]);

  const improvements = useMemo(() => {
    // extract optimization suggestions if present
    if (!optimization) return [];
    if (Array.isArray(optimization)) return optimization.slice(0,5).map(o => (typeof o === 'string' ? o : (o.text || JSON.stringify(o))));

    // new: optimization_factors from backend (structured)
    if (optimization.optimization_factors && Array.isArray(optimization.optimization_factors)) {
      if (optimization.optimization_factors.length === 0) {
        // friendly fallback when backend returns empty factors
        return [`No optimization suggestions found for ${selectedMetric} over the last ${optimization.period_days || daysRange} days. Try increasing the analysis window or choosing a different metric.`];
      }
      return optimization.optimization_factors.slice(0,5).map(f => (typeof f === 'string' ? f : (f.text || f.description || JSON.stringify(f))));
    }

    if (optimization.suggestions && Array.isArray(optimization.suggestions)) return optimization.suggestions.map(s => s.text || JSON.stringify(s));
    if (optimization.recommendations && Array.isArray(optimization.recommendations)) return optimization.recommendations.map(r => r.text || JSON.stringify(r));

    // fallback: try to stringify
    return [optimization.message || optimization.summary || JSON.stringify(optimization)].slice(0,5);
  }, [optimization, daysRange, selectedMetric]);

  const runOptimization = async (metric = selectedMetric) => {
    setOptLoading(true);
    setOptError(null);
    try {
      const res = await insightsAPI.getOptimization(daysRange, metric);
      setOptimization(res || null);
    } catch (e) {
      console.error('Optimization failed', e);
      setOptError(String(e?.message || e));
      setOptimization(null);
    } finally {
      setOptLoading(false);
    }
  };

  if (loading && !healthData.length) return <LoadingSpinner message="Loading insights..." />;
  if (error && !healthData.length) return <ErrorMessage message={error} />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Health Insights</h1>
        <p className="page-subtitle">Aggregated trends, recommendations and suggested improvements</p>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Trends</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 13, color: '#64748b' }}>Range:
                  <select value={daysRange} onChange={e=> setDaysRange(Number(e.target.value))} style={{ marginLeft:8 }}>
                    {[30,60,90,180].map(n=> <option key={n} value={n}>{n}d</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <HealthTrendsCard selectedMetric={selectedMetric} onChangeMetric={setSelectedMetric} windowData={healthData} />
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', marginBottom: 16 }}>
              <MetricCard title="Sleep Score" value={metrics.sleep.last != null ? Math.round(metrics.sleep.last) : '-'} unit="pts" change={metrics.sleep.change} color="purple" />
              <MetricCard title="Steps" value={metrics.steps.last != null ? fmtNumber(Math.round(metrics.steps.last)) : '-'} change={metrics.steps.change} color="yellow" />
              <MetricCard title="Resting HR" value={metrics.rhr.last != null ? Math.round(metrics.rhr.last) : '-'} unit="bpm" change={metrics.rhr.change} color="red" />
              <MetricCard title="Recovery" value={metrics.recovery.last != null ? Math.round(metrics.recovery.last) : '-'} change={metrics.recovery.change} color="green" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card">
                <div className="card-header"><h3 className="card-title">Key Insights</h3></div>
                <div className="card-content">
                  {keyInsights.length ? (
                    <ul>
                      {keyInsights.map((k, i) => <li key={i} style={{ marginBottom:8 }}>{typeof k === 'string' ? k : (k.text || k.title || JSON.stringify(k))}</li>)}
                    </ul>
                  ) : (
                    <div style={{ color: '#64748b' }}>No key insights available.</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3 className="card-title">What to improve</h3></div>
                <div className="card-content">
                  {improvements.length ? (
                    <ol>
                      {improvements.map((imp, i) => <li key={i} style={{ marginBottom:8 }}>{imp}</li>)}
                    </ol>
                  ) : (
                    <div style={{ color: '#64748b' }}>No concrete suggestions yet. Try generating an AI report to get personalized actions.</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }} className="card">
              <div className="card-header"><h3 className="card-title">Detailed Analysis</h3></div>
              <div className="card-content" style={{ padding: 12 }}>
                <HealthChart data={healthData} metric={selectedMetric} height={300} type={chartProps.type} rollingWindow={chartProps.rollingWindow} />
              </div>
            </div>
          </div>

          <aside>
            <div style={{ position: 'sticky', top: 16, display: 'grid', gap: 12 }}>
              <div className="card">
                <div className="card-header"><h3 className="card-title">Personalized Recommendations</h3></div>
                <div className="card-content">
                  <SleepRecommendations recommendations={recommendationsList.slice(0,8)} />
                  {!recommendationsList.length && <div style={{ color: '#64748b' }}>No recommendations available.</div>}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3 className="card-title">Optimization</h3></div>
                <div className="card-content">
                  <div style={{ marginBottom: 8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div><strong>Target metric</strong>: {selectedMetric}</div>
                    <div>
                      <button onClick={() => runOptimization()} disabled={optLoading} style={{ marginRight:8 }}>{optLoading ? 'Running…' : 'Re-run'}</button>
                    </div>
                  </div>
                  {optError && <div style={{ color: 'salmon', marginBottom:8 }}>{optError}</div>}
                  {optimization ? (
                    <div style={{ fontSize: 14 }}>
                      {Array.isArray(optimization) ? (
                        <ul>
                          {optimization.slice(0,6).map((o,i)=> <li key={i}>{typeof o==='string'?o:(o.text||JSON.stringify(o))}</li>)}
                        </ul>
                      ) : (
                        <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(optimization, null, 2)}</pre>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b' }}>No optimization data.</div>
                  )}
                </div>
              </div>

              <HealthReport llmAvailable={true} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Insights;