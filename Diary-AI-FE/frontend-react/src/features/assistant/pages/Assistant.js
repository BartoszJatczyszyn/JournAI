import React, { useEffect, useState } from 'react';
import HealthReport from 'components/ai/HealthReport';
import PromptBox from 'components/ai/PromptBox';
import ReportsHistory from 'components/ai/ReportsHistory';
import llm from 'infrastructure/api/llm';

export default function Assistant() {
  const [llmOk, setLlmOk] = useState(null);
  const checkHealth = async () => {
    try {
      await llm.health();
      setLlmOk(true);
    } catch (e) {
      setLlmOk(false);
    }
  };
  useEffect(() => { checkHealth(); }, []);
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>AI Assistant</h2>
      {llmOk === false && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
          padding: 12, borderRadius: 8, marginBottom: 12
        }}>
          LLM is disabled or unavailable. Start the stack with the --llm flag: ./start_all.sh --llm or ./full_reset.sh --llm
          <button onClick={checkHealth} style={{ marginLeft: 12 }}>Check again</button>
        </div>
      )}
      <HealthReport llmAvailable={!!llmOk} />
      <PromptBox llmAvailable={!!llmOk} />
      <ReportsHistory />
    </div>
  );
}
