import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
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
import { monitoringAPI } from 'features/monitoring/api';
import { journalAPI } from 'features/journal/api';
import { healthAPI } from 'features/health/api';
import { sleepsAPI } from '../../sleep/api';
import { healthAPI2 } from 'infrastructure/api';
import BodyMetricsCard from '../../../components/BodyMetricsCard';
import JournalEditor from '../../../components/JournalEditor';

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
  // local fallback for user-created sleep sessions when backend insert is not available
  const [localSleepSaved, setLocalSleepSaved] = useState(null);
  const [editingSleepId, setEditingSleepId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [sleepTooltip, setSleepTooltip] = useState(null);
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
          if (Array.isArray(hrRes.samples)) hrNormalized = hrRes;
          else if (Array.isArray(hrRes)) hrNormalized = { samples: hrRes };
          else if (hrRes.data && Array.isArray(hrRes.data.samples)) hrNormalized = hrRes.data;
          else if (hrRes.data && Array.isArray(hrRes.data)) hrNormalized = { samples: hrRes.data };
          else hrNormalized = { summary: hrRes };
        }
        setHr(hrNormalized || null);
        setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateDaily', attempted: String(day) }]);

        const hasSamples = hrNormalized && Array.isArray(hrNormalized.samples) && hrNormalized.samples.length;
        if (!hasSamples) {
          try {
            const summaryRes = await monitoringAPI.getHeartRateSummary(day).catch(() => null);
            if (summaryRes && (Array.isArray(summaryRes.samples) && summaryRes.samples.length)) {
              setHr({ samples: summaryRes.samples });
            }
            setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateSummary', attempted: String(day), found: !!summaryRes }]);
            if (summaryRes && (Array.isArray(summaryRes.samples) && summaryRes.samples.length)) {
              setHr({ samples: summaryRes.samples });
            } else if (summaryRes && (summaryRes.data && Array.isArray(summaryRes.data))) {
              setHr({ samples: summaryRes.data });
            } else if (summaryRes && typeof summaryRes === 'object' && Object.keys(summaryRes).length) {
              setHr({ summary: summaryRes });
            } else {
              let altDay = day;
              try {
                const iso = new Date(day);
                if (!Number.isNaN(iso.getTime())) altDay = iso.toISOString().slice(0,10);
              } catch (e) {
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
        const hasRrSamples = rrRes && (Array.isArray(rrRes.samples) && rrRes.samples.length);
        if (!hasRrSamples) {
          try {
            const rawRr = await monitoringAPI.getRespiratoryRateRaw(day).catch(() => null);
            if (Array.isArray(rawRr) && rawRr.length) setRr({ samples: rawRr });
          } catch (e) {
            console.warn('getRespiratoryRateRaw failed', e);
          }
        }
        const hasStressSamples = stressRes && (Array.isArray(stressRes.samples) && stressRes.samples.length);
        if (!hasStressSamples) {
          try {
            const rawStress = await monitoringAPI.getStressRaw(day).catch(() => null);
            if (Array.isArray(rawStress) && rawStress.length) setStress({ samples: rawStress });
          } catch (e) {
            console.warn('getStressRaw failed', e);
          }
        }
        let sleepArr = [];
        if (sleepEvRes) {
          if (Array.isArray(sleepEvRes)) sleepArr = sleepEvRes;
          else if (Array.isArray(sleepEvRes.events)) sleepArr = sleepEvRes.events;
          else if (Array.isArray(sleepEvRes.rows)) sleepArr = sleepEvRes.rows;
          else if (Array.isArray(sleepEvRes.data)) sleepArr = sleepEvRes.data;
          else if (Array.isArray(sleepEvRes.items)) sleepArr = sleepEvRes.items;
          else if (sleepEvRes.events && typeof sleepEvRes.events === 'object') sleepArr = [sleepEvRes.events];
          else sleepArr = [];
        }
        setSleepEvents(sleepArr);
        setJournal(journalRes || null);

        let match = null;
        if (Array.isArray(healthDataRes)) {
          match = healthDataRes.find(d => {
            const key = String(d.day ?? d.date ?? d.label ?? d.x);
            return key === String(day);
          });
        } else if (healthDataRes && healthDataRes.data && Array.isArray(healthDataRes.data)) {
          match = healthDataRes.data.find(d => String(d.day ?? d.date ?? d.label ?? d.x) === String(day));
        }
        if (!hrNormalized || !(hrNormalized.samples && hrNormalized.samples.length)) {
          try {
            const rawRows = await monitoringAPI.getHeartRateRaw(day).catch(() => null);
            setHrAttempts(prev => [...prev, { endpoint: 'getHeartRateRaw', attempted: String(day), found: !!rawRows }]);
            if (Array.isArray(rawRows) && rawRows.length) setHr({ samples: rawRows });
          } catch (e) {
            console.warn('getHeartRateRaw failed', e);
          }
        }
        let enriched = match ? { ...match } : null;
        if (currentWeight && currentWeight.day) {
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

  // Sleep entry form state
  const [sleepStartInput, setSleepStartInput] = useState('');
  const [sleepEndInput, setSleepEndInput] = useState('');
  const [sleepDurationInput, setSleepDurationInput] = useState(''); // in minutes
  const [sleepScoreInput, setSleepScoreInput] = useState('');
  // separate date/time parts for nicer picking
  const [sleepStartDate, setSleepStartDate] = useState(day || '');
  const [sleepStartTime, setSleepStartTime] = useState('');
  const [sleepEndDate, setSleepEndDate] = useState(day || '');
  const [sleepEndTime, setSleepEndTime] = useState('');
  const [savingSleep, setSavingSleep] = useState(false);
  const [saveSleepError, setSaveSleepError] = useState(null);

  const handleSaveSleep = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setSavingSleep(true);
    setSaveSleepError(null);
    try {
      // compose start/end from separate date/time parts when provided
      const composedStart = sleepStartInput || (sleepStartDate && sleepStartTime ? `${sleepStartDate}T${sleepStartTime}` : null);
      const composedEnd = sleepEndInput || (sleepEndDate && sleepEndTime ? `${sleepEndDate}T${sleepEndTime}` : null);
      // normalize inputs
      const payload = {
        day,
        sleep_start: composedStart || null,
        sleep_end: composedEnd || null,
        // convert minutes to seconds when provided as minutes
        sleep_duration_seconds: sleepDurationInput ? Math.round(Number(sleepDurationInput) * 60) : null,
        sleep_score: sleepScoreInput ? Number(sleepScoreInput) : null,
      };
      // attempt API create if available
      let created = null;
      if (sleepsAPI && typeof sleepsAPI.createSleep === 'function') {
        try {
          const res = await sleepsAPI.createSleep(payload);
          // expect res.sleep or created object; adapt if API returns raw
          created = res && (res.sleep || res.data || res);
        } catch (err) {
          console.warn('createSleep API failed', err);
          // continue to fallback
        }
      }
      if (created) {
        // update UI: append to sleepEvents so chart shows it
        const createdRow = (created.sleep || created);
        const row = {
          sleep_id: createdRow.sleep_id ?? createdRow.sleep_id ?? null,
          timestamp: createdRow.sleep_start || payload.sleep_start,
          event: 'manual_entry',
          duration: payload.sleep_duration_seconds || createdRow.sleep_duration_seconds || null,
          _created: true,
          raw: createdRow,
        };
        setSleepEvents(prev => [...prev, row]);
        setLocalSleepSaved({ source: 'api', created });
      } else {
        // fallback: store a local synthetic sleep event and show message
        const row = {
          timestamp: payload.sleep_start || (payload.sleep_end || `${day}T00:00:00`),
          event: 'manual_entry_local',
          duration: payload.sleep_duration_seconds || (payload.sleep_end && payload.sleep_start ? Math.round((new Date(payload.sleep_end) - new Date(payload.sleep_start))/1000) : null),
          _created: true,
          raw: payload,
        };
        setSleepEvents(prev => [...prev, row]);
        setLocalSleepSaved({ source: 'local', payload });
      }
      // clear inputs
      setSleepStartInput('');
      setSleepStartDate(day || '');
      setSleepStartTime('');
      setSleepEndInput('');
      setSleepEndDate(day || '');
      setSleepEndTime('');
      setSleepDurationInput('');
      setSleepScoreInput('');
    } catch (err) {
      console.error('Save sleep failed', err);
      setSaveSleepError(String(err?.message || err));
    } finally {
      setSavingSleep(false);
    }
  };

  const handleDeleteSleep = async (sleepId) => {
    if (!sleepId) return;
    try {
      await sleepsAPI.deleteSleep(sleepId).catch(() => { throw new Error('delete failed') });
      setSleepEvents(prev => prev.filter(s => s.sleep_id !== sleepId));
    } catch (err) {
      console.error('Delete sleep failed', err);
      // fallback: remove locally
      setSleepEvents(prev => prev.filter(s => s.sleep_id !== sleepId));
    }
  };

  const startEdit = (item) => {
    setEditingSleepId(item.sleep_id || item.raw?.sleep_id || null);
    // split existing ISO-like datetime into date and time parts for nicer inputs
    const rawStart = item.raw?.sleep_start || item.timestamp || '';
    const rawEnd = item.raw?.sleep_end || '';
    const split = (iso) => {
      if (!iso) return { date: '', time: '' };
      try {
        const dt = new Date(String(iso));
        if (Number.isNaN(dt.getTime())) return { date: '', time: '' };
        const date = dt.toISOString().slice(0,10);
        const hh = String(dt.getHours()).padStart(2,'0');
        const mm = String(dt.getMinutes()).padStart(2,'0');
        return { date, time: `${hh}:${mm}` };
      } catch (e) {
        return { date: '', time: '' };
      }
    };
    const s = split(rawStart);
    const e = split(rawEnd);
    setEditForm({
      sleep_start: rawStart || '',
      sleep_end: rawEnd || '',
      sleep_start_date: s.date,
      sleep_start_time: s.time,
      sleep_end_date: e.date,
      sleep_end_time: e.time,
      sleep_duration_minutes: item.duration ? Math.round(item.duration/60) : '',
      sleep_score: item.raw?.sleep_score ?? '',
      _localKey: item.key ?? item.sleep_id ?? item.timestamp,
    });
  };

  const saveEdit = async () => {
    const sleepId = editingSleepId;
    if (!sleepId) return;
    try {
      // prefer composed date+time parts when available in editForm
      const composedStart = editForm.sleep_start || (editForm.sleep_start_date && editForm.sleep_start_time ? `${editForm.sleep_start_date}T${editForm.sleep_start_time}` : null);
      const composedEnd = editForm.sleep_end || (editForm.sleep_end_date && editForm.sleep_end_time ? `${editForm.sleep_end_date}T${editForm.sleep_end_time}` : null);
      const payload = {
        sleep_start: composedStart || null,
        sleep_end: composedEnd || null,
        sleep_duration_seconds: editForm.sleep_duration_minutes ? Math.round(Number(editForm.sleep_duration_minutes) * 60) : null,
        sleep_score: editForm.sleep_score ? Number(editForm.sleep_score) : null,
      };
      const res = await sleepsAPI.updateSleep(sleepId, payload).catch(() => null);
      if (res && res.sleep) {
        const updated = res.sleep;
        setSleepEvents(prev => prev.map(s => (s.sleep_id === sleepId ? { ...s, timestamp: updated.sleep_start, duration: updated.sleep_duration_seconds, raw: updated } : s)));
      } else {
        // fallback local update
        setSleepEvents(prev => prev.map(s => (s.sleep_id === sleepId ? { ...s, timestamp: payload.sleep_start || s.timestamp, duration: payload.sleep_duration_seconds || s.duration, raw: { ...(s.raw||{}), ...payload } } : s)));
      }
    } catch (err) {
      console.error('Update sleep failed', err);
    } finally {
      setEditingSleepId(null);
      setEditForm({});
    }
  };

  // auto-compute duration (minutes) when both start and end are present
  useEffect(() => {
    // derive full ISO strings from either combined inputs or separate date/time parts
    const startIso = sleepStartInput || (sleepStartDate && sleepStartTime ? `${sleepStartDate}T${sleepStartTime}` : null);
    const endIso = sleepEndInput || (sleepEndDate && sleepEndTime ? `${sleepEndDate}T${sleepEndTime}` : null);
    if (!startIso || !endIso) return;
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;
      let deltaMs = e.getTime() - s.getTime();
      if (deltaMs <= 0) deltaMs += 24 * 60 * 60 * 1000; // assume next day
      const mins = Math.round(deltaMs / 60000);
      if (Number.isFinite(mins)) setSleepDurationInput(String(mins));
    } catch (err) {
      // ignore parse errors
    }
  }, [sleepStartInput, sleepEndInput, sleepStartDate, sleepStartTime, sleepEndDate, sleepEndTime]);

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

  // Normalize respiratory rate samples into rrChartData
  const rrChartData = useMemo(() => {
    let samples = null;
    if (!rr) return [];
    if (Array.isArray(rr?.samples)) samples = rr.samples;
    else if (rr && rr.summary && typeof rr.summary === 'object') {
      const keys = ['rows','data','items','samples','points'];
      for (const k of keys) {
        if (Array.isArray(rr.summary[k]) && rr.summary[k].length) {
          samples = rr.summary[k];
          break;
        }
      }
      if (!samples && Array.isArray(rr.summary) && rr.summary.length) samples = rr.summary;
    }
    if (!samples && Array.isArray(rr)) samples = rr;
    if (!samples) return [];

    const rows = samples
      .map((s) => {
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
        const val = s.rr ?? s.value ?? s.v ?? s.rate ?? null;
        const num = val != null ? Number(val) : null;
        if (num == null || Number.isNaN(num)) return null;
        return { t: tms, rr: num };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
    return rows;
  }, [rr]);

  // Hourly averages for respiratory rate (simple mean)
  const rrHourly = useMemo(() => {
    if (!rrChartData || !rrChartData.length) return [];
    const buckets = Array.from({ length: 24 }).map(() => []);
    for (const r of rrChartData) {
      const dt = new Date(r.t);
      if (Number.isNaN(dt.getTime())) continue;
      const h = dt.getHours();
      if (typeof r.rr === 'number') buckets[h].push(r.rr);
    }
    return buckets.map((vals, h) => {
      const count = vals.length;
      const mean = count ? vals.reduce((a, b) => a + b, 0) / count : null;
      const label = `${String(h).padStart(2, '0')}:00`;
      return { hour: h, hourLabel: label, mean, count };
    });
  }, [rrChartData]);

  const RRTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{new Date(d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="tooltip-value">
            <span className="tooltip-metric">RR:</span>
            <span className="tooltip-number">{d.rr != null ? Number(d.rr).toFixed(2) : 'n/a'}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const RRBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{d.hourLabel}</p>
          <p className="tooltip-value"><span className="tooltip-metric">Mean:</span> <span className="tooltip-number">{d.mean != null ? Number(d.mean).toFixed(2) : 'n/a'}</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">Median:</span> <span className="tooltip-number">{d.median != null ? Number(d.median).toFixed(2) : 'n/a'}</span></p>
          <p className="tooltip-value"><span className="tooltip-metric">IQR:</span> <span className="tooltip-number">{d.q1 != null && d.q3 != null ? `${Number(d.q1).toFixed(2)}–${Number(d.q3).toFixed(2)}` : 'n/a'}</span></p>
          <p className="tooltip-extra">Samples: {d.count || 0}</p>
        </div>
      );
    }
    return null;
  };

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
          {rrChartData && rrChartData.length ? (
            <>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rrChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <RTooltip content={<RRTooltip />} />
                    <Line type="monotone" dataKey="rr" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: '100%', height: 110, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rrHourly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis dataKey="hourLabel" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#cbd5e1" />
                      <RTooltip content={<RRBarTooltip />} />
                    <Bar dataKey="mean" fill="#10b981" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>Samples per hour — N: {rrHourly.reduce((s, x) => s + (x.count || 0), 0)}</div>
              </div>
            </>
          ) : (
            <div style={{ color: '#64748b' }}>
              {rr ? (
                <div>
                  <div>Respiratory response returned (no chartable samples):</div>
                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(rr, null, 2)}</pre>
                </div>
              ) : (
                <div>No respiratory rate data.</div>
              )}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Sleep Events</h3>
          {Array.isArray(sleepEvents) && sleepEvents.length ? (
            (() => {
              // Helper: parse duration string "HH:MM:SS" into seconds
              const parseDuration = (dur) => {
                if (!dur) return 60; // default 1min
                if (typeof dur === 'number') return Math.floor(dur);
                const parts = String(dur).split(':').map((p) => Number(p));
                if (!parts.length) return 60;
                // support SS, MM:SS or HH:MM:SS
                if (parts.length === 1) return parts[0];
                if (parts.length === 2) return parts[0] * 60 + parts[1];
                return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
              };

              const dayStart = new Date(String(day) + 'T00:00:00').getTime();
              const secondsInDay = 24 * 60 * 60;

              const colorFor = (ev) => {
                const map = {
                  deep_sleep: '#0ea5a4',
                  light_sleep: '#60a5fa',
                  rem: '#a78bfa',
                  awake: '#ef4444',
                  movement: '#f59e0b'
                };
                return map[ev] || '#94a3b8';
              };

              // Build visual items with left% and width%
              const items = sleepEvents.map((e, idx) => {
                const ts = e.timestamp ?? e.ts ?? e.time ?? e.t;
                const ev = e.event ?? e.type ?? e.name ?? 'event';
                const dur = e.duration ?? e.length ?? e.seconds ?? null;
                const parsed = Date.parse(String(ts));
                if (Number.isNaN(parsed)) return null;
                const startSec = (parsed - dayStart) / 1000;
                const durSec = typeof dur === 'number' ? dur : parseDuration(dur);
                // clamp inside day for visual
                const clippedStart = Math.max(0, Math.min(startSec, secondsInDay));
                const clippedDur = Math.max(1, Math.min(durSec, secondsInDay));
                const left = (clippedStart / secondsInDay) * 100;
                const width = (clippedDur / secondsInDay) * 100;
                return { key: idx, ev, ts: parsed, durSec, left, width, color: colorFor(ev), raw: e };
              }).filter(Boolean);

              // Hour ticks 0..23
              const hours = Array.from({ length: 24 }).map((_, h) => {
                const label = `${String(h).padStart(2, '0')}:00`;
                const left = (h / 24) * 100;
                return { h, label, left };
              });

              return (
                <div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    {/* legend */}
                    {Object.entries({ deep_sleep: 'Deep', light_sleep: 'Light', rem: 'REM', awake: 'Awake' }).map(([k, label]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 18, height: 12, background: colorFor(k), borderRadius: 2 }} />
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'relative', height: 56, background: '#071028', borderRadius: 6, overflow: 'hidden', padding: '8px 6px' }}>
                    {/* hour grid */}
                    {hours.map(hrTick => (
                      <div key={hrTick.h} style={{ position: 'absolute', left: `${hrTick.left}%`, top: 0, bottom: 0, width: 0, borderLeft: '1px solid rgba(148,163,184,0.06)' }} />
                    ))}
                    {/* event bars */}
                    {items.map(it => (
                      <div
                        key={it.key}
                        onMouseEnter={() => setSleepTooltip({ item: it })}
                        onMouseLeave={() => setSleepTooltip(null)}
                        style={{ position: 'absolute', left: `${it.left}%`, width: `${Math.max(0.3, it.width)}%`, top: 10, height: 36, background: it.color, borderRadius: 4, opacity: 0.98, display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#021018', fontWeight: 700, fontSize: 12, cursor: 'default', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ textShadow: 'none', color: '#021018' }}>{it.ev.replace('_', ' ')}</div>
                          <div style={{ display: 'flex', gap: 6, paddingRight: 6 }}>
                            {(it._created || it.raw?.sleep_id || it.sleep_id) && (
                              <>
                                <button onClick={() => startEdit(it)} style={{ background: 'transparent', border: 'none', color: '#021018', cursor: 'pointer' }}>✎</button>
                                <button onClick={() => handleDeleteSleep(it.sleep_id || it.raw?.sleep_id)} style={{ background: 'transparent', border: 'none', color: '#021018', cursor: 'pointer' }}>🗑</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* tooltip */}
                    {sleepTooltip && sleepTooltip.item && (
                      (() => {
                        const it = sleepTooltip.item;
                        const center = Math.min(99, it.left + (it.width || 0) / 2);
                        const start = new Date(it.ts);
                        const end = new Date(it.ts + (it.durSec || 0) * 1000);
                        const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const durSec = Math.round(it.durSec || 0);
                        const hh = String(Math.floor(durSec / 3600)).padStart(2,'0');
                        const mm = String(Math.floor((durSec % 3600) / 60)).padStart(2,'0');
                        const ss = String(durSec % 60).padStart(2,'0');
                        return (
                          <div style={{ position: 'absolute', left: `${center}%`, transform: 'translateX(-50%)', top: -56, minWidth: 160, background: '#0b1220', border: '1px solid rgba(148,163,184,0.08)', padding: 8, borderRadius: 6, boxShadow: '0 4px 12px rgba(2,6,23,0.6)', color: '#e6eef8', fontSize: 13 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.ev.replace('_', ' ')}</div>
                            <div style={{ color: '#94a3b8' }}>{fmt(start)} → {fmt(end)}</div>
                            <div style={{ color: '#94a3b8', marginTop: 4 }}>Duration: {hh}:{mm}:{ss}</div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                  {/* inline edit form */}
                  {editingSleepId && (
                    <div style={{ marginTop: 8, background: '#071028', padding: 8, borderRadius: 6 }}>
                      <div style={{ color: '#94a3b8', marginBottom: 6 }}>Edit sleep (id: {editingSleepId})</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Start date</label>
                          <input type="date" value={editForm.sleep_start_date || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_start_date: e.target.value }))} style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Start time</label>
                          <input type="time" value={editForm.sleep_start_time || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_start_time: e.target.value }))} style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>End date</label>
                          <input type="date" value={editForm.sleep_end_date || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_end_date: e.target.value }))} style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>End time</label>
                          <input type="time" value={editForm.sleep_end_time || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_end_time: e.target.value }))} style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Duration (min)</label>
                          <input value={editForm.sleep_duration_minutes || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_duration_minutes: e.target.value }))} placeholder="Duration (min)" style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Sleep score</label>
                          <input value={editForm.sleep_score || ''} onChange={(e) => setEditForm(f => ({ ...f, sleep_score: e.target.value }))} placeholder="Sleep score" style={{ width: '100%', padding: 8, background: '#021026', color: '#e6eef8', borderRadius: 4 }} />
                        </div>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={saveEdit} className="liquid-button prev">Save</button>
                        <button onClick={() => { setEditingSleepId(null); setEditForm({}); }} className="liquid-button">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>Events: {items.length}</div>
                </div>
              );
            })()
          ) : (
            <div style={{ color: '#64748b' }}>
              <div>No sleep events for this day.</div>
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8, color: '#94a3b8' }}>Add a manual sleep session for {day}:</div>
                <form onSubmit={handleSaveSleep} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Start date</label>
                    <input type="date" value={sleepStartDate} onChange={(e) => setSleepStartDate(e.target.value)} style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Start time</label>
                    <input type="time" value={sleepStartTime} onChange={(e) => setSleepStartTime(e.target.value)} style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>End date</label>
                    <input type="date" value={sleepEndDate} onChange={(e) => setSleepEndDate(e.target.value)} style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 6 }}>End time</label>
                    <input type="time" value={sleepEndTime} onChange={(e) => setSleepEndTime(e.target.value)} style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Duration (minutes)</label>
                    <input value={sleepDurationInput} onChange={(e) => setSleepDurationInput(e.target.value)} placeholder="480" style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>Sleep score (0-100)</label>
                    <input value={sleepScoreInput} onChange={(e) => setSleepScoreInput(e.target.value)} placeholder="85" style={{ width: '100%', padding: 8, background: '#071028', color: '#e6eef8', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 4 }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="submit" className="liquid-button prev" disabled={savingSleep}>{savingSleep ? 'Saving...' : 'Save sleep'}</button>
                    <button type="button" onClick={() => { setSleepStartInput(''); setSleepEndInput(''); setSleepDurationInput(''); setSleepScoreInput(''); }} className="liquid-button">Clear</button>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{saveSleepError ? `Error: ${saveSleepError}` : localSleepSaved ? `Saved (${localSleepSaved.source})` : ''}</div>
                  </div>
                </form>
                <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>Note: this will attempt to POST to the backend (/api/sleeps). If the backend doesn't accept inserts, the entry will be saved locally in the UI only.</div>
              </div>
            </div>
          )}
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
