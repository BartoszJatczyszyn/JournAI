import React, { useEffect, useMemo, useState } from 'react';
import { workoutsOverview, topProgress, strengthCorrelations } from 'features/strength/api';
import TonnageTimeline from '../../../components/TonnageTimeline';
import MetricCard from '../../../components/MetricCard';
import ScatterPlot from '../../../components/ScatterPlot';

export default function StrengthAnalytics(){
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState([]);
  const [topProg, setTopProg] = useState([]);
  const [corr, setCorr] = useState(null);
  const [, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [o, t, c] = await Promise.all([
          workoutsOverview({ days }),
          topProgress({ days, limit: 5 }),
          strengthCorrelations({ days }),
        ]);
        if (!cancelled){
          setOverview(o.series || []);
          setTopProg(t.items || []);
          setCorr(c || null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days]);

  const totalVolume = useMemo(() => (overview||[]).reduce((s, r) => s + Number(r.total_volume || 0), 0), [overview]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Siła — analityka</h1>
        <div className="toolbar flex items-center gap-3">
          <select value={days} onChange={e=>setDays(Number(e.target.value))} className="period-select">
            <option value={7}>7 dni</option>
            <option value={14}>2 tygodnie</option>
            <option value={30}>30 dni</option>
            <option value={90}>3 miesiące</option>
            <option value={180}>6 miesięcy</option>
            <option value={365}>12 miesięcy</option>
          </select>
        </div>
      </div>

      <div className="page-content space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title={`Tonaż (${days}d)`} value={totalVolume.toFixed(0)} unit="kg" icon="🏋️" color="green" subtitle="Suma kg * powt." />
          <MetricCard title={`Sesje (${days}d)`} value={(overview||[]).length} unit="" icon="📅" color="indigo" subtitle="Aktywności strength" />
          <MetricCard title="Trendów (Top)" value={(topProg||[]).length} unit="" icon="📈" color="purple" subtitle="Ćwiczenia z najsilniejszym trendem" />
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between"><h3 className="card-title">Tonaż w czasie</h3><span className="text-[10px] text-gray-500">kg</span></div>
          <div className="card-content">
            {overview.length ? (
              <TonnageTimeline data={(overview||[]).map(r => ({ date: new Date(r.day).toISOString().slice(0,10), bodyPart: 'all', volume: r.total_volume }))} />
            ) : <div className="text-xs text-gray-500">Brak danych</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Top progres (trend Est1RM)</h3></div>
          <div className="card-content grid grid-cols-1 md:grid-cols-2 gap-3">
            {(topProg||[]).map(item => (
              <div key={item.exerciseId} className="p-2 rounded border bg-gray-50 dark:bg-gray-900/30">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-[11px] text-gray-500">pkt: {item.points} · R²: {Number(item.r2 || 0).toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">Δ {Number(item.slope || 0).toFixed(2)}</div>
                    <div className="text-[11px] text-gray-500">PR: {item.lastPR ? `${item.lastPR} kg` : '—'}</div>
                  </div>
                </div>
                {item.lastPRDate && (
                  <div className="text-[10px] text-gray-500 mt-1">ostatni PR: {new Date(item.lastPRDate).toLocaleDateString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="card-title">Korelacje</h3>
            {corr && (
              <div className="text-[11px] text-gray-500">Pearson: vol vs logs = <b>{Number(corr.volume_vs_logs||0).toFixed(2)}</b> · vol vs sets = <b>{Number(corr.volume_vs_sets||0).toFixed(2)}</b></div>
            )}
          </div>
          <div className="card-content grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-gray-500 mb-1">Tonaż vs liczba ćwiczeń</div>
              <ScatterPlot data={corr?.scatter_logs || []} height={160} xLabel="Tonaż (kg)" yLabel="# ćwiczeń" color="#3b82f6" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">Tonaż vs liczba serii</div>
              <ScatterPlot data={corr?.scatter_sets || []} height={160} xLabel="Tonaż (kg)" yLabel="# serii" color="#ef4444" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
