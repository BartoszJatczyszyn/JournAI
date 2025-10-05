import React, { useState } from 'react';
import llm from '../../services/llm';

export default function PromptBox({ llmAvailable = true }) {
  const [prompt, setPrompt] = useState('Describe the impact of sleep and resting heart rate on energy in the last month.');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse('');
    try {
      const body = {
        messages: [
          { role: 'system', content: 'You are a health and performance assistant. Respond briefly and concretely.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
        top_p: 0.9,
      };
      const { data } = await llm.chat(body);
      setResponse(data?.content || '');
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Ask AI</h3>
      </div>
      <div className="card-body">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          style={{ width: '100%', marginBottom: 12 }}
        />
        <button onClick={send} disabled={loading || !llmAvailable}>
          {loading ? 'Sending…' : 'Send'}
        </button>
  {!llmAvailable && <div className="error" style={{ color: 'salmon', marginTop: 8 }}>LLM offline — send your query after starting the LLM service.</div>}
        {error && (<div className="error" style={{ color: 'salmon', marginTop: 8 }}>{String(error)}</div>)}
        {response && (
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--panel-bg, #0b1220)', padding: 12, borderRadius: 8, border: '1px solid #2c3a52', marginTop: 12 }}>
            {response}
          </pre>
        )}
      </div>
    </div>
  );
}
