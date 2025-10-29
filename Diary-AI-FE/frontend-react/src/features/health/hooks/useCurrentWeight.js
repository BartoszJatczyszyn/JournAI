import { useEffect, useState } from 'react';
import { healthAPI } from '../api';

export default function useCurrentWeight() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [cur, s] = await Promise.all([
          healthAPI.getCurrentWeight().catch(()=>null),
          healthAPI.getWeightStats().catch(()=>null),
        ]);
        if (!mounted) return;
        setData(cur || null);
        setStats(s || null);
      } catch (e) {
        if (mounted) setError(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return { data, stats, loading, error };
}
