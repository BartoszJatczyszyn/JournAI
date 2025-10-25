import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function ExerciseAnalysis() {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const res = await axios.get(`/api/strength/exercises/${id}/stats`);
      if (active) setData(res.data.series || []);
      const h = await axios.get(`/api/strength/exercises/${id}/history`, { params: { limit: 20 } });
      if (active) setHistory(h.data.items || []);
    };
    run();
    return () => { active = false; };
  }, [id]);

  return (
    <div>
      <h2>Exercise Analysis</h2>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="best_e1rm" stroke="#3b82f6" dot={false} name="Best e1RM" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 260, marginTop: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total_volume" fill="#10b981" name="Total Volume" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 24 }}>
        <h3>Workout History</h3>
        <div style={{ border: '1px solid #eee' }}>
          {history.length === 0 ? <div style={{ padding: 8, color: '#666' }}>No history</div> : (
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr><th>Date</th><th>Sets</th></tr>
              </thead>
              <tbody>
                {history.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.day}</td>
                    <td>
                      {(r.sets || []).map((s, i) => (
                        <span key={i} style={{ marginRight: 8 }}>{s.is_warmup ? 'W' : ''}{s.weight}x{s.reps}{s.rpe != null ? `@${s.rpe}` : ''}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
