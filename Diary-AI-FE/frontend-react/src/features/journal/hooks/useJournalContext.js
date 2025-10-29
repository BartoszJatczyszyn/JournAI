import { useEffect, useState } from 'react';
import { journalAPI } from '../api';

export function useJournalContext(day, windowSize=7) {
  const [meta, setMeta] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(null);
    Promise.all([
      journalAPI.getMeta().catch(e => { throw e; }),
      journalAPI.getContext(day, windowSize).catch(e => { throw e; })
    ])
      .then(([metaRes, ctxRes]) => { if (!mounted) return; setMeta(metaRes); setContext(ctxRes); })
      .catch(e => { if (mounted) setError(e.message || 'Load failed'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [day, windowSize]);

  return { meta, context, loading, error };
}

export default useJournalContext;
