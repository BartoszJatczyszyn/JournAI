// Helpers for activity domain
export function isSportMatch(activity, sportKey){
  if (!activity) return false;
  const key = String(sportKey || '').toLowerCase();
  const sport = String(activity.sport || activity.type || activity.activity_type || '').toLowerCase();
  if (!key) return false;
  if (key === 'running') return sport.includes('run');
  if (key === 'walking') return sport.includes('walk');
  if (key === 'cycling') return sport.includes('cycl') || sport.includes('bike');
  if (key === 'swimming') return sport.includes('swim');
  if (key === 'hiking') return sport.includes('hik');
  return sport === key;
}
