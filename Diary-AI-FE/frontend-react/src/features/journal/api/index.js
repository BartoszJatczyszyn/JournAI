// Journal feature API facade
import infra from 'infrastructure/api/journal';

export const journalAPI = {
  async getEntry(date){ return infra.getEntry(date); },
  async updateEntry(date, data){ return infra.updateEntry(date, data); },
  async getMeta(){ return infra.getMeta(); },
  async getContext(date, window=7){ return infra.getContext(date, window); },
  async getCorrelations(start, end, method='pearson', opts={}){ return infra.getCorrelations(start, end, method, opts); },
  async getRecoveryComposite(start, end, params={}){ return infra.getRecoveryComposite(start, end, params); },
  async getLatest(createIfMissing=true){ return infra.getLatest(createIfMissing); },
};

export default journalAPI;
