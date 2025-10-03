import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  // BarChart,
  // Bar
} from 'recharts';
import { ComposedChart, Area, Bar } from 'recharts';
import { monitoringAPI, sleepsAPI, journalAPI, healthAPI2, healthAPI } from '../services';
import BodyMetricsCard from '../components/BodyMetricsCard';
import JournalEditor from '../components/JournalEditor';

const DayDetail = () => {
  const { day } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hr, setHr] = useState(null);
  const [hrAttempts, setHrAttempts] = useState([]);
  // reference to avoid unused-var ESLint warning
  void hrAttempts;
  const [hrRaw, setHrRaw] = useState(null);
  const [stressRaw, setStressRaw] = useState(null);
  const [stress, setStress] = useState(null);
  const [rr, setRr] = useState(null);
  const [sleepEvents, setSleepEvents] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [journal, setJournal] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
  const [hrRes, stressRes, rrRes, sleepEvRes, journalRes, healthDataRes, currentWeight] = await Promise.all([
          monitoringAPI.getHeartRateDaily(day).catch(() => null),
          monitoringAPI.getStressDaily(day).catch(() => null),
          monitoringAPI.getRespiratoryRateDaily(day).catch(() => null),
          sleepsAPI.getSleepEvents(day).catch(() => null),
          journalAPI.getEntry(day).catch(() => null),
          // fetch a range of daily summaries and pick the matching day
          healthAPI2.getHealthData(365).catch(() => null),
          healthAPI.getCurrentWeight ? healthAPI.getCurrentWeight().catch(() => null) : null,
        ]);
    if (!mounted) return;
  // keep raw response for debugging
  setHrRaw(hrRes || null);
  setStressRaw(stressRes || null);
  // Normalize hr response shapes
        let hrNormalized = null;
        if (hrRes) {
          // If API already returns { samples: [...] }
          if (Array.isArray(hrRes.samples)) {
            hrNormalized = hrRes;
          } else if (Array.isArray(hrRes)) {
            // If API returns an array of samples directly
            hrNormalized = { samples: hrRes };
          } else if (hrRes.data && Array.isArray(hrRes.data.samples)) {
            hrNormalized = hrRes.data;
          } else if (hrRes.data && Array.isArray(hrRes.data)) {
            hrNormalized = { samples: hrRes.data };
          } else {
            // Unknown shape: keep as object under 'summary' so user can inspect
            hrNormalized = { summary: hrRes };
          }
        }
        setHr(hrNormalized || null);
        setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateDaily', attempted: String(day) }]);

        // If we didn't get samples, try getHeartRateSummary and alternative date formats
        const hasSamples = hrNormalized && Array.isArray(hrNormalized.samples) && hrNormalized.samples.length;
        if (!hasSamples) {
          try {
            // Try summary endpoint
            const summaryRes = await monitoringAPI.getHeartRateSummary(day).catch(() => null);
            setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateSummary', attempted: String(day), found: !!summaryRes }]);
            if (summaryRes && (Array.isArray(summaryRes.samples) && summaryRes.samples.length)) {
              setHr({ samples: summaryRes.samples });
              } else if (summaryRes && (summaryRes.data && Array.isArray(summaryRes.data))) {
                setHr({ samples: summaryRes.data });
              } else if (summaryRes && typeof summaryRes === 'object' && Object.keys(summaryRes).length) {
                setHr({ summary: summaryRes });
            } else {
              // Try alternative date formats: YYYY-MM-DD extracted from provided param
              let altDay = day;
              try {
                const iso = new Date(day);
                if (!Number.isNaN(iso.getTime())) altDay = iso.toISOString().slice(0,10);
              } catch (e) {
                // ignore invalid date formats when probing alternative day formats
                console.warn('Alt day parse failed', e);
              }
              if (altDay !== String(day)) {
                const altRes = await monitoringAPI.getHeartRateDaily(altDay).catch(() => null);
                setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateDaily', attempted: altDay, found: !!altRes }]);
                if (altRes && Array.isArray(altRes)) setHr({ samples: altRes });
                else if (altRes && altRes.samples && Array.isArray(altRes.samples)) setHr(altRes);
                else if (altRes && altRes.data && Array.isArray(altRes.data)) setHr({ samples: altRes.data });
              }
            }
              } catch (e) {
                console.warn('Extra HR attempts failed', e);
              }
        }
        setStress(stressRes || null);
        setRr(rrRes || null);
        setSleepEvents((sleepEvRes && sleepEvRes.events) || sleepEvRes || []);
        setJournal(journalRes || null);

        // Try to locate the matching daily summary from healthData
        let match = null;
        if (Array.isArray(healthDataRes)) {
          match = healthDataRes.find(d => {
            const key = String(d.day ?? d.date ?? d.label ?? d.x);
            return key === String(day);
          });
        } else if (healthDataRes && healthDataRes.data && Array.isArray(healthDataRes.data)) {
          match = healthDataRes.data.find(d => String(d.day ?? d.date ?? d.label ?? d.x) === String(day));
        }
        // Merge in current weight (if for same day) or attach separately when viewing that exact date
        let enriched = match ? { ...match } : null;
        if (currentWeight && currentWeight.day) {
          // If viewing the day equal to latest weight day, surface weight_kg
            if (String(currentWeight.day) === String(day)) {
              enriched = enriched || { day };
              if (currentWeight.weight_kg != null) enriched.weight_kg = currentWeight.weight_kg;
              if (currentWeight.bmi != null) enriched.bmi = currentWeight.bmi;
            }
        }
        setDailySummary(enriched || match || null);
      } catch (e) {
        console.error('Day detail load error', e);
        if (mounted) setError(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [day]);

  // Normalize and prepare chart data for heart rate samples (hook must run on every render)
  const hrChartData = useMemo(() => {
  // If hr.samples missing, try to find an array in hr.summary or in the raw response under common keys
  let samples = null;
  if (!hr && !hrRaw) return [];
  if (Array.isArray(hr?.samples)) samples = hr.samples;
  else if (hr && hr.summary && typeof hr.summary === 'object') {
      const keys = ['rows','data','items','samples','points'];
      for (const k of keys) {
        if (Array.isArray(hr.summary[k]) && hr.summary[k].length) {
          samples = hr.summary[k];
          break;
        }
      }
      // also consider top-level array under hr.summary
      if (!samples && Array.isArray(hr.summary) && hr.summary.length) samples = hr.summary;
    }
    // If still no samples, inspect the raw hr response (garmin_heart_rate_data)
    if (!samples && hrRaw) {
      if (Array.isArray(hrRaw) && hrRaw.length) samples = hrRaw;
      else if (hrRaw.data && Array.isArray(hrRaw.data) && hrRaw.data.length) samples = hrRaw.data;
      else if (hrRaw.rows && Array.isArray(hrRaw.rows) && hrRaw.rows.length) samples = hrRaw.rows;
      else if (hrRaw.items && Array.isArray(hrRaw.items) && hrRaw.items.length) samples = hrRaw.items;
    }
  // As a last attempt, if hr contains top-level array fields
  if (!samples && hr && Array.isArray(hr)) samples = hr;
  if (!samples) return [];
    const rows = samples
      .map((s) => {
        // Prefer database-style fields: ts (timestamp) and bpm (integer)
        // fall back to other common names if necessary
        let ts = s.ts ?? s.t ?? s.timestamp ?? s.time;
        if (ts == null && s.day && s.time) ts = `${s.day} ${s.time}`;
        let tms = null;
        if (typeof ts === 'number') tms = ts > 1e12 ? ts : ts * 1000;
        else if (typeof ts === 'string') {
          let s2 = ts.trim();
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s2)) s2 = s2.replace(' ', 'T');
          const parsed = Date.parse(s2);
          if (!Number.isNaN(parsed)) tms = parsed;
        }
        if (!tms) return null;
        // bpm might be direct or nested under value-like keys
        const bpm = s.bpm ?? s.bpm_value ?? s.value ?? s.v ?? s.bpm_raw ?? null;
        const hrVal = bpm != null ? Number(bpm) : null;
        if (hrVal == null || Number.isNaN(hrVal)) return null;
        return { t: tms, hr: hrVal };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
    return rows;
  }, [hr, hrRaw]);

  // Normalize stress samples (garmin_stress_data) into stressChartData
  const stressChartData = useMemo(() => {
    // find array of samples from stress, stress.summary or raw
    let samples = null;
    if (!stress && !stressRaw) return [];
    if (Array.isArray(stress?.samples)) samples = stress.samples;
    else if (stress && stress.summary && typeof stress.summary === 'object') {
      const keys = ['rows','data','items','samples','points'];
      for (const k of keys) {
        if (Array.isArray(stress.summary[k]) && stress.summary[k].length) {
          samples = stress.summary[k];
          break;
        }
      }
      if (!samples && Array.isArray(stress.summary) && stress.summary.length) samples = stress.summary;
    }
    if (!samples && stressRaw) {
      if (Array.isArray(stressRaw) && stressRaw.length) samples = stressRaw;
      else if (stressRaw.data && Array.isArray(stressRaw.data) && stressRaw.data.length) samples = stressRaw.data;
      else if (stressRaw.rows && Array.isArray(stressRaw.rows) && stressRaw.rows.length) samples = stressRaw.rows;
      else if (stressRaw.items && Array.isArray(stressRaw.items) && stressRaw.items.length) samples = stressRaw.items;
    }
    if (!samples && stress && Array.isArray(stress)) samples = stress;
    if (!samples) return [];

    const rows = samples
      .map((s) => {
        // Prefer ts and stress fields from garmin_stress_data
        let ts = s.ts ?? s.t ?? s.timestamp ?? s.time;
        if (ts == null && s.day && (s.stress != null) && s.time) ts = `${s.day} ${s.time}`;
        let tms = null;
        if (typeof ts === 'number') tms = ts > 1e12 ? ts : ts * 1000;
        else if (typeof ts === 'string') {
          let s2 = ts.trim();
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s2)) s2 = s2.replace(' ', 'T');
          const parsed = Date.parse(s2);
          if (!Number.isNaN(parsed)) tms = parsed;
        }
        if (!tms) return null;
        const val = s.stress ?? s.value ?? s.v ?? s.level ?? s.stress_value ?? null;
        const num = val != null ? Number(val) : null;
        if (num == null || Number.isNaN(num)) return null;
        return { t: tms, stress: num };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);

    return rows;
  }, [stress, stressRaw]);

  // Compute hourly averages for HR (hours 0..23). Result: [{ hour: 0..23, hourLabel: 'HH:00', avg }]
  function median(arr) {
    if (!arr || !arr.length) return null;
    const s = arr.slice().sort((a,b) => a-b);
    const m = Math.floor(s.length/2);
    return s.length % 2 === 1 ? s[m] : (s[m-1] + s[m]) / 2;
  }
  function iqrValues(arr) {
    if (!arr || arr.length < 2) return { q1: null, q3: null };
    const s = arr.slice().sort((a,b) => a-b);
    const q = (p) => {
      const idx = p * (s.length - 1);
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      if (lo === hi) return s[lo];
      return s[lo] * (hi - idx) + s[hi] * (idx - lo);
    };
    return { q1: q(0.25), q3: q(0.75) };
  }

  const hrHourly = useMemo(() => {
    if (!hrChartData || !hrChartData.length) return [];
    const buckets = Array.from({ length: 24 }).map(() => []);
    for (const r of hrChartData) {
      const dt = new Date(r.t);
      if (Number.isNaN(dt.getTime())) continue;
      const h = dt.getHours();
      if (typeof r.hr === 'number') buckets[h].push(r.hr);
    }
    return buckets.map((vals, h) => {
      const count = vals.length;
      const mean = count ? vals.reduce((a, b) => a + b, 0) / count : null;
      const med = median(vals);
      const { q1, q3 } = iqrValues(vals);
      const label = `${String(h).padStart(2, '0')}:00`;
      return { hour: h, hourLabel: label, mean, median: med, q1, q3, count };
    });
  }, [hrChartData]);

  // Compute hourly averages for Stress
  const stressHourly = useMemo(() => {
    if (!stressChartData || !stressChartData.length) return [];
    const buckets = Array.from({ length: 24 }).map(() => []);
    for (const r of stressChartData) {
      const dt = new Date(r.t);
      if (Number.isNaN(dt.getTime())) continue;
      const h = dt.getHours();
      if (typeof r.stress === 'number') buckets[h].push(r.stress);
    }
    return buckets.map((vals, h) => {
      const count = vals.length;
      const mean = count ? vals.reduce((a, b) => a + b, 0) / count : null;
      const med = median(vals);
      const { q1, q3 } = iqrValues(vals);
      const label = `${String(h).padStart(2, '0')}:00`;
      return { hour: h, hourLabel: label, mean, median: med, q1, q3, count };
    });
  }, [stressChartData]);

  const StressTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{new Date(d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="tooltip-value">
            <span className="tooltip-metric">Stress:</span>
            <span className="tooltip-number">{d.stress != null ? Number(d.stress).toFixed(1) : 'n/a'}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const HRTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{new Date(d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="tooltip-value">
            <span className="tooltip-metric">HR:</span>
            <span className="tooltip-number">{d.hr != null ? Number(d.hr).toFixed(0) : 'n/a'} bpm</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const HRBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{d.hourLabel}</p>
          <p className="tooltip-value"><span className="tooltip-metric">Mean:</span> <span className="tooltip-number">{d.mean != null ? Number(d.mean).toFixed(1) : 'n/a'} bpm</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">Median:</span> <span className="tooltip-number">{d.median != null ? Number(d.median).toFixed(1) : 'n/a'} bpm</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">IQR:</span> <span className="tooltip-number">{d.q1 != null && d.q3 != null ? `${Number(d.q1).toFixed(1)}–${Number(d.q3).toFixed(1)}` : 'n/a'}</span></p>
          <p className="tooltip-extra">Samples: {d.count || 0}</p>
        </div>
      );
    }
    return null;
  };

  const StressBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{d.hourLabel}</p>
          <p className="tooltip-value"><span className="tooltip-metric">Mean:</span> <span className="tooltip-number">{d.mean != null ? Number(d.mean).toFixed(1) : 'n/a'}</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">Median:</span> <span className="tooltip-number">{d.median != null ? Number(d.median).toFixed(1) : 'n/a'}</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">IQR:</span> <span className="tooltip-number">{d.q1 != null && d.q3 != null ? `${Number(d.q1).toFixed(1)}–${Number(d.q3).toFixed(1)}` : 'n/a'}</span></p>
          <p className="tooltip-extra">Samples: {d.count || 0}</p>
        </div>
      );
    }
    return null;
  };


  if (loading) return <LoadingSpinner message={`Loading data for ${day}...`} />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{day}</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Daily detail</p>
        </div>
        <div>
          <Link to="/days" className="liquid-button prev">← Back</Link>
        </div>
      </div>
  {/* removed HR endpoints-attempted debug panel */}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Daily Summary</h3>
          {dailySummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.keys(dailySummary).sort().map((k) => (
                <div key={k} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ minWidth: 160, color: '#64748b' }}>{k}</div>
                  <div style={{ color: '#e6eef8', wordBreak: 'break-word' }}>{String(dailySummary[k])}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>No daily summary found for this day.</div>
          )}
        </div>
    <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Heart Rate</h3>
          {hrChartData && hrChartData.length ? (
            <>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#cbd5e1" />
                  <YAxis domain={[ 'dataMin - 5', 'dataMax + 5' ]} stroke="#cbd5e1" />
                  <RTooltip content={<HRTooltip />} />
                  <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Hourly average bar chart */}
            <div style={{ width: '100%', height: 140, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hrHourly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="hourLabel" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#cbd5e1" />
                  <RTooltip content={<HRBarTooltip />} />
                  {/* IQR band as an Area between q1 and q3 (use two areas stacked) */}
                  <Area type="monotone" dataKey="q3" stroke="none" fill="#ef444430" fillOpacity={0.5} />
                  <Area type="monotone" dataKey="q1" stroke="none" fill="#00000000" />
                  <Bar dataKey="mean" fill="#ef4444" />
                  {/* median as a thin bar to stand out */}
                  <Bar dataKey="median" fill="#ffb4b4" barSize={6} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>Samples per hour shown below — N: {hrHourly.reduce((s, x) => s + (x.count || 0), 0)}</div>
            </div>
            </>
          ) : (
              <div style={{ color: '#64748b' }}>
                {hrRaw ? (
                  <div>
                    <div>No heart rate samples found. Raw response returned:</div>
                    <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(hrRaw, null, 2)}</pre>
                  </div>
                ) : hr && hr.summary ? (
                  <div>
                    <div>No heart rate samples found. Summary fields returned:</div>
                    <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(hr.summary, null, 2)}</pre>
                  </div>
                ) : (
                  <div>No heart rate data.</div>
                )}
              </div>
            )}
          {/* HR debug info removed: chart rows and raw response panels */}
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
            Chart rows: {hrChartData.length}
          </div>
        </div>

    <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Stress Summary</h3>
          {stressChartData && stressChartData.length ? (
            <>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stressChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <RTooltip content={<StressTooltip />} />
                  <Line type="monotone" dataKey="stress" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Hourly average bar chart for Stress */}
            <div style={{ width: '100%', height: 120, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stressHourly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="hourLabel" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#cbd5e1" />
                  <RTooltip content={<StressBarTooltip />} />
                  <Area type="monotone" dataKey="q3" stroke="none" fill="#0ea5e930" fillOpacity={0.5} />
                  <Area type="monotone" dataKey="q1" stroke="none" fill="#00000000" />
                  <Bar dataKey="mean" fill="#0ea5e9" />
                  <Bar dataKey="median" fill="#bfefff" barSize={6} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>Samples per hour — N: {stressHourly.reduce((s, x) => s + (x.count || 0), 0)}</div>
            </div>
            </>
          ) : (
            <div style={{ color: '#64748b' }}>No stress data.</div>
          )}
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
            Chart rows: {stressChartData.length}
          </div>
        </div>

    <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Respiratory Rate</h3>
          {rr ? (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(rr, null, 2)}</pre>
          ) : (<div style={{ color: '#64748b' }}>No respiratory rate data.</div>)}
        </div>

  <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Sleep Events</h3>
          {Array.isArray(sleepEvents) && sleepEvents.length ? (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(sleepEvents, null, 2)}</pre>
          ) : (<div style={{ color: '#64748b' }}>No sleep events for this day.</div>)}
        </div>

        <BodyMetricsCard day={day} />

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Journal Entry</h3>
          <JournalEditor day={day} initialData={journal || {}} onSaved={(entry) => setJournal(entry)} />
        </div>
      </div>
    </div>
  );
};

export default DayDetail;
