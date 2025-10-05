import React, { useEffect, useState } from 'react';
import llm from '../../services/llm';
import toast from 'react-hot-toast';

export default function HealthReport({ llmAvailable = true }) {
  const [days, setDays] = useState(30);
  const [language, setLanguage] = useState('pl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState('');
  const [latest, setLatest] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await llm.getHealthReport(days, language);
      setReport(data?.report || '');
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message;
      setError(msg);
      toast.error(`Generate failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatest = async () => {
    try {
      const { data } = await llm.getLatestStored(language);
      if (data?.status === 'success') {
        setLatest(data.report);
      } else {
        setLatest(null);
      }
    } catch (e) {
      // non-fatal
    }
  };

  const generateNow = async () => {
    setGenLoading(true);
    setError(null);
    try {
      await llm.generateNow(days, language);
      toast.success('Report saved');
      await fetchLatest();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message;
      setError(msg);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setGenLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3>AI Health Report</h3>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => {
            const md = `# Health Report (Preview)\n\n- Days: ${days}\n- Language: ${language}\n\n---\n\n${report}`;
            navigator.clipboard.writeText(md)
              .then(() => toast.success('Preview copied as Markdown'))
              .catch(() => toast.error('Copy failed'));
          }}>Copy preview (MD)</button>
          <button onClick={() => {
            const md = `# Health Report (Preview)\n\n- Days: ${days}\n- Language: ${language}\n\n---\n\n${report}`;
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `health_report_preview_${days}d_${language}.md`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}>Download preview (MD)</button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <label>
            Days:
            <input type="number" min={7} max={180} value={days} onChange={e => setDays(parseInt(e.target.value || 30))} style={{ marginLeft: 8, width: 80 }} />
          </label>
          <label>
            Language:
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </label>
          <button onClick={fetchReport} disabled={loading || !llmAvailable}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={generateNow} disabled={genLoading || !llmAvailable}>
            {genLoading ? 'Saving…' : 'Generate now (store)'}
          </button>
        </div>
        {!llmAvailable && <div style={{ color: 'salmon', marginBottom: 8 }}>LLM offline — generowanie zablokowane.</div>}
        {error && <div className="error" style={{ color: 'salmon', marginBottom: 8 }}>{String(error)}</div>}
        {loading && !report && <div>Loading…</div>}
        {report && (
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--panel-bg, #0b1220)', padding: 12, borderRadius: 8, border: '1px solid #2c3a52' }}>
            {report}
          </pre>
        )}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Latest stored report</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button onClick={fetchLatest}>Refresh</button>
            {latest && (
              <span style={{ opacity: 0.8, fontSize: 12 }}>
                day: {latest.day} | language: {latest.language} | window: {latest.days_window} | created_at: {latest.created_at}
              </span>
            )}
          </div>
          {latest?.report ? (
            <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--panel-bg, #0b1220)', padding: 12, borderRadius: 8, border: '1px solid #2c3a52' }}>
              {latest.report}
            </pre>
          ) : (
            <div style={{ opacity: 0.8 }}>No stored report yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
