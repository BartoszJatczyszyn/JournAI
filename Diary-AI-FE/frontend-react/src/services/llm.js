// Minimal LLM service shim used for build-time compatibility.
// In production this should be replaced with the real LLM client implementation.

const noop = async (..._args) => ({ data: {} });

const llm = {
  // body: { messages, temperature, max_tokens, top_p }
  chat: async (_body) => {
    // Provide a deterministic placeholder response so UI can render during dev/build.
    return { data: { content: 'LLM stub: no model available in this environment.' } };
  },
  getHistory: async (_limit = 10, _language = 'en') => {
    return { data: { reports: [] } };
  },
  // fallback for other calls used elsewhere
  getReport: noop,
  createReport: noop,
};

export default llm;
