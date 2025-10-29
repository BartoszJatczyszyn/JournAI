import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function MuscleGroupAnalysis() {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [contrib, setContrib] = useState([]);
  const [freq, setFreq] = useState([]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const [res, pc, wf] = await Promise.all([
        axios.get(`/api/strength/muscle-groups/${id}/weekly-volume`, { params: { weeks: 16 } }),
        axios.get(`/api/strength/muscle-groups/${id}/exercise-contribution`, { params: { days: 30 } }),
        axios.get(`/api/strength/muscle-groups/${id}/weekly-frequency`, { params: { weeks: 16 } }),
      ]);
      if (active) {
        setData(res.data.series || []);
        setContrib(pc.data.series || []);
        setFreq(wf.data.series || []);
      }
    };
    run();
    return () => { active = false; };
  }, [id]);

  const merged = useMemo(() => {
    const byWeek = Object.create(null);
    (data || []).forEach(d => { byWeek[d.week] = { week: d.week, total_volume: d.total_volume }; });
    (freq || []).forEach(f => {
      if (!byWeek[f.week]) byWeek[f.week] = { week: f.week };
      byWeek[f.week].count = f.count;
    });
    return Object.values(byWeek).sort((a, b) => (a.week || '').localeCompare(b.week || ''));
  }, [data, freq]);

  const avgWeeklySessions = useMemo(() => {
    if (!freq || !freq.length) return 0;
    const total = freq.reduce((acc, x) => acc + (x.count || 0), 0);
    return (total / freq.length).toFixed(2);
  }, [freq]);

  return (
    <div>
      <h2>Muscle Group Weekly Volume</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={merged} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={40} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="total_volume" name="Volume (kg)" fill="#6366f1" />
              <Line yAxisId="right" type="monotone" dataKey="count" name="Sessions/wk" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ width: 220, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Avg weekly sessions</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{avgWeeklySessions}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Last {Math.max(freq.length, 0)} weeks</div>
        </div>
      </div>
      <div style={{ height: 320, marginTop: 24 }}>
        <h3>Exercise Contribution to Volume (last 30d)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={contrib} dataKey="volume" nameKey="name" outerRadius={120} label>
              {contrib.map((entry, index) => (
                <Cell key={`c-${index}`} fill={["#f87171","#60a5fa","#34d399","#fbbf24","#a78bfa","#f472b6","#22d3ee"][index % 7]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
