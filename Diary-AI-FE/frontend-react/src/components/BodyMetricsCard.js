import React from 'react';
import { useCurrentWeight } from 'hooks';
import { healthAPI } from '../features/health/api';
import TrendSparkline from './TrendSparkline';

function formatDelta(v) {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : '';
  return sign + v.toFixed(2) + ' kg';
}

export default function BodyMetricsCard(/* day */) {
  const { data, stats, loading, error } = useCurrentWeight();
  const [history, setHistory] = React.useState([]);
  const [correlations, setCorrelations] = React.useState([]);
  const [loadingExtra, setLoadingExtra] = React.useState(false);
  const latest = data;
  const show = !!latest;
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingExtra(true);
      try {
        // intentionally unused: hist, corr — keep for future API wiring
        // const [hist, corr] = await Promise.all([
        //   healthAPI.getWeightHistory ? healthAPI.getWeightHistory(60).catch(()=>[]) : [],
        //   healthAPI.api ? Promise.resolve([]) : []
        // ]);
        // correlations endpoint: we reuse generic api instance via healthAPI.getAnalyticsInfo? We'll call directly below
      } catch (e) { console.warn('failed loading weight extras', e); }
      finally {
        if (mounted) setLoadingExtra(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Fetch correlations separately (explicit to keep backward compatibility)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const corr = await (healthAPI && healthAPI.getWeightCorrelations ? healthAPI.getWeightCorrelations(90).catch(()=>null) : null);
        if (mounted && corr && Array.isArray(corr.pairs)) setCorrelations(corr.pairs);
      } catch (e) {
        console.warn('failed fetching fallback weight data', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Manually call endpoints using api if not exposed yet
  React.useEffect(() => {
    let mounted = true;
    async function fallbackCalls() {
      try {
        const h = await fetch('/api/weight/history?days=60').then(r=>r.ok?r.json():[]).catch(()=>[]);
        if (mounted && Array.isArray(h)) setHistory(h.slice().reverse().map(r => ({ date: r.day, value: r.weight_kg })));
        const c = await fetch('/api/weight/correlations?days=90').then(r=>r.ok?r.json():null).catch(()=>null);
        if (mounted && c && Array.isArray(c.pairs)) setCorrelations(c.pairs);
      } catch (e) { console.warn('failed fallback calls', e); }
    }
    fallbackCalls();
    return () => { mounted = false; };
  }, []);

  const sparkData = history.map(h => ({ value: h.value }));

  return (
    <div className="card" style={{ padding:16 }}>
      <h3 style={{ marginTop:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>Body Metrics</span>
        {sparkData.length > 3 && <TrendSparkline data={sparkData.slice(-30)} width={140} height={34} color="#38bdf8" />}
      </h3>
      {(loading || loadingExtra) && <div style={{ color:'#64748b' }}>Loading…</div>}
      {error && <div style={{ color:'#f87171' }}>{error}</div>}
      {!loading && !error && !show && (
        <div style={{ color:'#64748b' }}>No weight data.</div>
      )}
      {show && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            <Metric title="Latest Weight" value={latest.weight_kg != null ? latest.weight_kg.toFixed(2)+' kg' : '—'} sub={latest.day} highlight />
            <Metric title="BMI" value={latest.bmi != null ? latest.bmi.toFixed(1) : '—'} />
            {latest.body_fat_percentage != null && <Metric title="Body Fat %" value={latest.body_fat_percentage.toFixed(1)+' %'} />}
            {latest.muscle_mass_kg != null && <Metric title="Muscle" value={latest.muscle_mass_kg.toFixed(2)+' kg'} />}
            {latest.body_water_percentage != null && <Metric title="Water %" value={latest.body_water_percentage.toFixed(1)+' %'} />}
            <Metric title="7d Avg" value={stats?.avg_7d != null ? stats.avg_7d.toFixed(2)+' kg' : '—'} />
            <Metric title="30d Avg" value={stats?.avg_30d != null ? stats.avg_30d.toFixed(2)+' kg' : '—'} />
            <Metric title="Δ vs 7d" value={formatDelta(stats?.delta_from_7d)} trend={stats?.delta_from_7d} />
            <Metric title="Δ vs 30d" value={formatDelta(stats?.delta_from_30d)} trend={stats?.delta_from_30d} />
            <Metric title="Trend 7d" value={stats?.trend_7d_slope != null ? (stats.trend_7d_slope*7).toFixed(2)+' kg/wk' : '—'} trend={stats?.trend_7d_slope} />
          </div>
          {correlations.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:12, color:'#94a3b8' }}>Top Correlations (|r| sorted)</div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {correlations.slice(0,6).map(c => (
                  <div key={c.metric} style={{ fontSize:11, background:'#1e293b', padding:'4px 8px', borderRadius:6, border:'1px solid #334155', display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ color:'#64748b' }}>{c.metric}</span>
                    <span style={{ color: c.pearson_r > 0 ? '#22c55e' : '#f87171' }}>{c.pearson_r.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize:12, color:'#64748b' }}>Trend = linear regression slope over last entries (converted to weekly). Correlations use Pearson (&gt;=3 overlapping points).</div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, sub, highlight, trend }) {
  const color = trend != null ? (trend > 0 ? '#f87171' : trend < 0 ? '#22c55e' : '#94a3b8') : '#e2e8f0';
  return (
    <div style={{ minWidth:140, display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ fontSize:12, color:'#94a3b8' }}>{title}</span>
      <span style={{ fontSize:18, fontWeight:600, color: highlight ? '#38bdf8' : color }}>{value}</span>
      {sub && <span style={{ fontSize:11, color:'#64748b' }}>{sub}</span>}
    </div>
  );
}
