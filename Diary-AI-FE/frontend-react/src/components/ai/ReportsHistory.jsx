import React, { useEffect, useState } from 'react';
import llm from '../../services/llm';
import toast from 'react-hot-toast';

export default function ReportsHistory() {
  const [language, setLanguage] = useState('pl');
  const [limit, setLimit] = useState(5);
  const [history, setHistory] = useState([]);
  const [selectedA, setSelectedA] = useState(null);
  const [selectedB, setSelectedB] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await llm.getHistory(limit, language);
      const rows = data?.reports || [];
      setHistory(rows);
      if (rows.length > 0) setSelectedA(rows[0]);
      if (rows.length > 1) setSelectedB(rows[1]);
    } catch (e) {
      toast.error(`Failed to load history: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header"><h3>Reports History</h3></div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            Language:
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Limit:
            <input type="number" min={1} max={50} value={limit} onChange={e => setLimit(parseInt(e.target.value || 5))} style={{ marginLeft: 8, width: 80 }} />
          </label>
          <button onClick={fetchHistory} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>

        {history.length === 0 && <div style={{ opacity: 0.8, marginTop: 8 }}>No reports yet.</div>}

        {history.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <h4>Pick A</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {history.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => setSelectedA(r)} style={{ width: '100%', textAlign: 'left' }}>
                        {r.day} ({r.language}) [{r.days_window}d]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Pick B</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {history.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => setSelectedB(r)} style={{ width: '100%', textAlign: 'left' }}>
                        {r.day} ({r.language}) [{r.days_window}d]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Meta</h4>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Latest: {history[0]?.day} • total: {history.length}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div>
                <h4>A: {selectedA ? `${selectedA.day} (${selectedA.language}) [${selectedA.days_window}d]` : '-'}</h4>
                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--panel-bg, #0b1220)', padding: 12, borderRadius: 8, border: '1px solid #2c3a52' }}>
                  {selectedA?.report || ''}
                </pre>
              </div>
              <div>
                <h4>B: {selectedB ? `${selectedB.day} (${selectedB.language}) [${selectedB.days_window}d]` : '-'}</h4>
                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--panel-bg, #0b1220)', padding: 12, borderRadius: 8, border: '1px solid #2c3a52' }}>
                  {selectedB?.report || ''}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
