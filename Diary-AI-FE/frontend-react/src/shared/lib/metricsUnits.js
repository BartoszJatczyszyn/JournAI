// Units for numeric metrics returned by the backend
// Keep keys identical to backend field names
const METRIC_UNITS = {
  distance_km: 'km',
  duration_min: 'min',
  avg_pace: 'min/km',
  avg_hr: 'bpm',
  max_hr: 'bpm',
  avg_steps_per_min: 'spm',
  avg_step_length_m: 'm',
  avg_vertical_oscillation: 'cm',
  avg_vertical_ratio: '%',
  avg_ground_contact_time: 'ms',
  vo2_max: 'ml/kg/min',
  calories: 'kcal',
  training_load: '',
};

export default METRIC_UNITS;
