import api from './api';

export const journalAPI = {
  getEntry: (date) => api.get(`/api/journal/${date}`),
  updateEntry: (date, data) => api.put(`/api/journal/${date}`, data),
  getMeta: () => api.get('/api/journal/meta'),
  getContext: (date, window=7) => api.get(`/api/journal/context/${date}?window=${window}`),
  getCorrelations: (start, end, method='pearson', opts={}) => {
    const min_abs = opts?.min_abs ?? 0;
    const qp = new URLSearchParams({ start, end, method, min_abs: String(min_abs) });
    // categories filter is frontend-only; backend returns map so we filter client-side
    return api.get(`/api/journal/correlations?${qp.toString()}`);
  },
  getRecoveryComposite: (start, end, params={}) => {
    const qp = new URLSearchParams({ start, end, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) }).toString();
    return api.get(`/api/journal/recovery_composite?${qp}`);
  },
  getLatest: (createIfMissing=true) => api.get(`/api/journal/latest?create_if_missing=${createIfMissing}`),
};

export default journalAPI;
