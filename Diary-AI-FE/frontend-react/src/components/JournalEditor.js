import React from 'react';
import RatingInput from './RatingInput';
import TrendSparkline from './TrendSparkline';
import useJournalContext from '../hooks/useJournalContext';
import useJournalSync from '../hooks/useJournalSync';

// Numeric-only fields we keep as number inputs
const numericFields = [
  { name: 'hrv_manual', label: 'HRV (manual)', min: 20, max: 150, step: 1 },
  { name: 'weight_morning_kg', label: 'Weight Morning (kg)', min: 20, max: 300, step: 0.1 },
];

// Rating fields (1-5 new schema)
const ratingFields = [
  { name: 'mood', label: 'Mood' },
  { name: 'stress_level', label: 'Stress' },
  { name: 'energy_level', label: 'Energy' },
  { name: 'focus_level', label: 'Focus' },
  { name: 'productivity_score', label: 'Productivity' },
  { name: 'sleep_quality_rating', label: 'Sleep Quality' },
  { name: 'soreness_level', label: 'Soreness' },
  { name: 'social_interactions_quality', label: 'Social' },
  { name: 'digestion_quality', label: 'Digestion' },
  { name: 'workout_intensity_rating', label: 'Workout Intensity' },
];

// Boolean flag fields
const booleanFields = [
  { name: 'meditated', label: 'Meditated' },
  { name: 'calories_controlled', label: 'Calories Controlled' },
  { name: 'night_snacking', label: 'Night Snacking' },
  { name: 'sweet_cravings', label: 'Sweet Cravings' },
  { name: 'steps_goal_achieved', label: 'Steps Goal' },
  { name: 'journaling_done', label: 'Journaling' },
  { name: 'stretching_mobility_done', label: 'Mobility' },
  { name: 'supplement_ashwagandha', label: 'Ashwagandha' },
  { name: 'supplement_magnesium', label: 'Magnesium' },
  { name: 'supplement_vitamin_d', label: 'Vitamin D' },
  { name: 'used_sleep_mask', label: 'Sleep Mask' },
  { name: 'used_ear_plugs', label: 'Ear Plugs' },
  { name: 'read_before_sleep', label: 'Read Pre-Sleep' },
  { name: 'used_phone_before_sleep', label: 'Phone Pre-Sleep' },
  { name: 'hot_bath_before_sleep', label: 'Hot Bath' },
  { name: 'blue_light_blockers', label: 'Blue Blockers' },
];

// Additional quantitative fields
const quantityFields = [
  { name: 'water_intake_ml', label: 'Water (ml)', min:0, max:20000, step:100 },
  { name: 'caffeine_mg', label: 'Caffeine (mg)', min:0, max:2000, step:50 },
  { name: 'fasting_hours', label: 'Fasting (h)', min:0, max:48, step:0.5 },
  { name: 'screen_time_minutes', label: 'Screen (min)', min:0, max:1440, step:5 },
  { name: 'outside_time_minutes', label: 'Outside (min)', min:0, max:1440, step:5 },
  { name: 'reading_time_minutes', label: 'Reading (min)', min:0, max:1440, step:5 },
  { name: 'hrv_manual', label: 'HRV (manual)', min:20, max:150, step:1 },
];

const NumberField = ({ label, value, onChange, min=0, max=10, step=1 }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
    <span style={{ color: '#94a3b8' }}>{label}{value!=null && <span style={{ marginLeft:4, color:'#e2e8f0' }}>({value})</span>}</span>
    <input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        padding: '4px 8px',
        borderRadius: 4,
        color: '#e2e8f0'
      }}
    />
  </label>
);

export default function JournalEditor({ day, initialData, onSaved }) {
  const { form, setForm, notes, setNotes, saving, status, error, autoStatus, unsyncedCount, isOffline, hasChanges, handleSave } = useJournalSync(day, initialData);
  const { context } = useJournalContext(day, 7);

  // descriptors for new 1–5 scale (index = value-1)
  const ratingDescriptors = ['Very Poor', 'Poor', 'OK', 'Good', 'Excellent'];

  React.useEffect(() => {
    if (context && context.entry) {
      setForm(f => ({ ...f, ...context.entry }));
      if (context.entry.notes && !notes) setNotes(context.entry.notes);
    }
  }, [context, setForm, notes, setNotes]);

  const completeness = context?.completeness_pct;
  const predictedEnergy = context?.predicted?.energy_level;
  const suggestions = context?.suggestions || {};
  const lastWindow = context?.last_window || {};

  const [openSections, setOpenSections] = React.useState(()=> new Set(['ratings','metrics','flags']));
  const toggle = (id) => setOpenSections(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const Section = ({ id, title, children }) => (
    <div style={{ border:'1px solid #334155', borderRadius:10, background:'#0f172a', padding:14, display:'flex', flexDirection:'column', gap:12 }}>
      <button type="button" onClick={()=>toggle(id)} style={{ background:'none', border:'none', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', color:'#e2e8f0', fontSize:14, fontWeight:600 }}>
        <span>{title}</span>
        <span style={{ fontSize:18, lineHeight:1, color:'#64748b' }}>{openSections.has(id)?'−':'+'}</span>
      </button>
      {openSections.has(id) && <div style={{ display:'flex', flexDirection:'column', gap:16 }}>{children}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center', fontSize:12, color:'#94a3b8' }}>
        {completeness != null && <div>Completeness: <span style={{ color: completeness >= 80 ? '#10b981' : '#f59e0b' }}>{completeness}%</span></div>}
        {predictedEnergy != null && <div>Tomorrow Energy Forecast: <strong style={{ color: predictedEnergy >=8 ? '#22c55e' : predictedEnergy <=4 ? '#f87171' : '#eab308' }}>{predictedEnergy}</strong></div>}
        {context?.summary_text && <div style={{ flexBasis:'100%', color:'#cbd5e1' }}>{context.summary_text}</div>}
      </div>
      <Section id="ratings" title="Subjective Ratings (1–5)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
        {ratingFields.map(r => {
          const series = lastWindow[r.name];
          const suggestion = suggestions[r.name];
          const showGhost = r.name === 'energy_level' && predictedEnergy != null && form[r.name] == null;
          return (
            <div key={r.name} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <RatingInput
                label={r.label}
                value={form[r.name] ?? null}
                onChange={(v) => setForm(f => ({ ...f, [r.name]: v }))}
                compact
                descriptors={ratingDescriptors}
              />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <TrendSparkline data={series} />
                <div style={{ fontSize:10, color:'#64748b', display:'flex', flexDirection:'column', gap:2 }}>
                  {suggestion != null && <span>Suggest: <span style={{ color:'#38bdf8' }}>{suggestion}</span></span>}
                  {showGhost && <span>Forecast: <span style={{ color:'#22c55e' }}>{predictedEnergy}</span></span>}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </Section>
      <Section id="metrics" title="Metrics & Quantities">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[...numericFields, ...quantityFields].map(f => (
            <NumberField
              key={f.name}
              label={f.label}
              value={form[f.name] ?? null}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(v) => setForm(prev => ({ ...prev, [f.name]: v }))}
            />
          ))}
        </div>
      </Section>

      <Section id="flags" title="Behaviors & Flags">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
          {booleanFields.map(b => {
            const val = form[b.name] ?? false;
            return (
              <label key={b.name} style={{ display:'flex', gap:6, alignItems:'center', background:'#1e293b', padding:'6px 8px', borderRadius:6, border:'1px solid #334155', fontSize:12, cursor:'pointer' }}>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => setForm(prev => ({ ...prev, [b.name]: e.target.checked }))}
                  style={{ width:16, height:16, accentColor:'#38bdf8', cursor:'pointer' }}
                />
                <span style={{ color:'#e2e8f0' }}>{b.label}</span>
              </label>
            );
          })}
        </div>
      </Section>
      <Section id="context" title="Context & Notes">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Notes / Context</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Free-form notes, location, context..."
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              padding: '6px 8px',
              borderRadius: 4,
              resize: 'vertical',
              fontFamily: 'inherit',
              color: '#e2e8f0'
            }}
          />
        </label>
      </Section>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => handleSave()}
            disabled={saving || !hasChanges()}
            className="liquid-button"
            style={{ opacity: (saving || !hasChanges()) ? 0.6 : 1, position: 'relative' }}
        >
          {saving ? 'Saving…' : (!hasChanges() ? 'No Changes' : 'Save Journal')}
        </button>
        {/* Status icons */}
        {isOffline && <span title="Offline – changes queued" style={{ fontSize:12, color:'#f59e0b' }}>⚡ Offline ({unsyncedCount})</span>}
        {!isOffline && unsyncedCount > 0 && <span title="Pending queued changes" style={{ fontSize:12, color:'#f59e0b' }}>⏳ {unsyncedCount} queued</span>}
        {status && <span style={{ color: '#10b981', fontSize: 12, display:'flex', alignItems:'center', gap:4 }}>✓ {status}</span>}
        {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}
        {autoStatus && !status && (
          <span style={{ color: autoStatus.includes('failed') ? '#f59e0b' : (autoStatus.includes('queued') || autoStatus.includes('Queued') ? '#f59e0b' : '#38bdf8'), fontSize: 12 }}>
            {autoStatus === 'Saving…' && '⟳ '}{autoStatus === 'Auto-saved' && '✓ '}{autoStatus}
          </span>
        )}
      </div>
    </div>
  );
}
