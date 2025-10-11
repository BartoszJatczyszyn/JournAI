// utils/timeUtils.js

/**
 * Converts minutes from midnight to a HH:MM string.
 * @param {number | null} m - Minutes from midnight.
 * @returns {string | null}
 */
export const mmToHHMM = (m) => {
  if (m == null || isNaN(m)) return null;
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  const mi = mm % 60;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
};

/**
 * Calculates the circular mean for an array of minutes.
 * @param {(number | null)[]} arr - Array of minutes from midnight.
 * @returns {number | null}
 */
export const circularMeanMinutes = (arr) => {
  const vals = (arr || []).filter(v => v != null && !isNaN(v)).map(Number);
  if (!vals.length) return null;

  const toRad = (deg) => deg * Math.PI / 180;
  const sumX = vals.reduce((acc, m) => acc + Math.cos(toRad((m / 1440) * 360)), 0);
  const sumY = vals.reduce((acc, m) => acc + Math.sin(toRad((m / 1440) * 360)), 0);

  if (sumX === 0 && sumY === 0) return null;

  const ang = Math.atan2(sumY, sumX);
  const angDeg = (ang * 180 / Math.PI + 360) % 360;
  return Math.round((angDeg / 360) * 1440) % 1440;
};

/**
 * Creates a time window around a center minute value.
 * @param {number | null} centerMin - The center of the window in minutes.
 * @param {number} plusMinus - The +/- range in minutes.
 * @returns {{start: number, end: number, label: string} | null}
 */
export const windowAround = (centerMin, plusMinus = 30) => {
  if (centerMin == null || isNaN(centerMin)) return null;
  const c = ((Math.round(centerMin) % 1440) + 1440) % 1440;
  const start = (c - plusMinus + 1440) % 1440;
  const end = (c + plusMinus + 1440) % 1440;
  return { start, end, label: `${mmToHHMM(start)}–${mmToHHMM(end)}` };
};

/**
 * Simple EWMA series for numeric arrays.
 * Returns an array of same length with smoothed values (nulls are propagated as no-update)
 * @param {(number|null)[]} arr
 * @param {number} alpha - smoothing factor 0..1 (higher = more responsive)
 */
export const ewmaSeries = (arr, alpha = 0.18) => {
  const out = [];
  if (!Array.isArray(arr)) return out;
  let s = null;
  for (const v of arr) {
    if (v == null || isNaN(v)) {
      out.push(s);
      continue;
    }
    const num = Number(v);
    if (s == null) s = num; else s = alpha * num + (1 - alpha) * s;
    out.push(s);
  }
  return out;
};

/**
 * Circular EWMA for minutes-of-day series. Returns minutes-of-day (0..1439) per index or null.
 * Operates by converting minutes to unit vectors and EWMA-ing the vectors.
 */
export const circularEWMASeries = (arr, alpha = 0.18) => {
  const out = [];
  if (!Array.isArray(arr)) return out;
  const twoPi = 2 * Math.PI;
  let ex = null, ey = null;
  for (const v of arr) {
    if (v == null || isNaN(v)) {
      if (ex == null) out.push(null); else {
        const ang = Math.atan2(ey, ex);
        const mins = Math.round(((ang / twoPi) * 1440 + 1440) % 1440);
        out.push(mins);
      }
      continue;
    }
    const m = Math.round(Number(v));
    const theta = (m / 1440) * twoPi;
    const vx = Math.cos(theta), vy = Math.sin(theta);
    if (ex == null) { ex = vx; ey = vy; } else { ex = alpha * vx + (1 - alpha) * ex; ey = alpha * vy + (1 - alpha) * ey; }
    const ang = Math.atan2(ey, ex);
    const mins = Math.round(((ang / twoPi) * 1440 + 1440) % 1440);
    out.push(mins);
  }
  return out;
};

/**
 * Circular rolling median (brute-force) per index using specified window (last N values including current).
 * Returns array of minutes or null.
 */
export const circularRollingMedian = (arr, window = 14) => {
  if (!Array.isArray(arr)) return [];
  const toNorm = (m) => ((Math.round(m) % 1440) + 1440) % 1440;
  const toRad = (m) => (m / 1440) * 2 * Math.PI;
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1).filter(v => v != null && !isNaN(v)).map(v => toNorm(v));
    if (!slice.length) { out.push(null); continue; }
    // brute-force: evaluate candidate at each sample and take argmin sum angular distance
    let best = null, bestScore = Infinity;
    for (const c of slice) {
      const ca = toRad(c);
      let score = 0;
      for (const v of slice) {
        const va = toRad(v);
        // shortest angular distance
        let d = Math.abs(Math.atan2(Math.sin(va - ca), Math.cos(va - ca)));
        score += d;
      }
      if (score < bestScore) { bestScore = score; best = c; }
    }
    out.push(Math.round(best));
  }
  return out;
};

/**
 * Format a pace stored as minutes (float, e.g. 5.25) into mm:ss string (e.g. "5:15").
 * Returns null for invalid input.
 */
export const formatPaceMinPerKm = (minFloat) => {
  if (minFloat == null) return null;
  // allow strings like "5:15" passthrough
  if (typeof minFloat === 'string' && minFloat.includes(':')) {
    // Accept formats: MM:SS or HH:MM:SS (possibly fractional seconds).
    // For MM:SS return as-is. For HH:MM:SS normalize to H:MM:SS (preserve hours).
    const parts = minFloat.split(':').map(p => p.trim());
    if (parts.length === 2) {
      // If minutes part >= 60, convert to H:MM:SS
      const mm = Number(parts[0]) || 0;
      const ss = Math.round(Number(parts[1].split('.')[0]) || 0);
      if (Math.abs(mm) >= 60) {
        const sign = mm < 0 ? '-' : '';
        const absMm = Math.abs(mm);
        const hours = Math.floor(absMm / 60);
        const mins = absMm % 60;
        return `${sign}${String(hours)}:${String(mins).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      }
      return minFloat;
    }
    if (parts.length === 3) {
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      const s = Math.round(Number(parts[2].split('.')[0]) || 0);
      // Format as H:MM:SS (no leading zero for hours)
      return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    // fallback
    return minFloat;
  }
  const num = Number(minFloat);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;

  // Distinguish numeric inputs that represent seconds vs minutes.
  // Common inputs:
  // - decimal minutes (e.g. 5.25) -> should be treated as minutes
  // - integer seconds (e.g. 93) -> should be treated as seconds
  // - values coming from mistaken HH:MM:SS -> parsePaceToMinutes may produce large minute values (e.g. 71.83)
  //   which must NOT be treated as seconds (that caused 71.83 -> 1:12 bug).
  // Heuristic used here:
  // - If the numeric value is an integer and between 60 and 600 (1s..10min) it's likely raw seconds -> format as seconds
  // - Or if the value is extremely large (>=3600) treat as seconds
  // Otherwise treat the number as minutes (possibly decimal) and format accordingly.
  const absNum = Math.abs(num);
  const looksLikeSeconds = (Number.isInteger(num) && absNum >= 60 && absNum <= 600) || absNum >= 3600;
  if (looksLikeSeconds) {
    const totalSeconds = Math.round(num);
    const absTotalSeconds = Math.abs(totalSeconds);
    if (absTotalSeconds >= 3600) {
      // Format as H:MM:SS
      const hours = Math.floor(absTotalSeconds / 3600);
      const rem = absTotalSeconds % 3600;
      const mins = Math.floor(rem / 60);
      const secs = rem % 60;
      const sign = num < 0 ? '-' : '';
      return `${sign}${String(hours)}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(Math.abs(totalSeconds % 60)).padStart(2, '0');
    return `${String(num < 0 ? -minutes : minutes)}:${seconds}`;
  }

  const whole = Math.floor(Math.abs(num));
  const frac = Math.abs(num) - whole;

  // Treat numeric input as decimal minutes: fractional part is fraction of a minute.
  // Example: 4.05 -> 4 minutes + 0.05*60 = 3 seconds
  let seconds = Math.round(frac * 60);
  let minutes = whole;
  // Normalize (carry) if seconds === 60
  if (seconds >= 60) {
    minutes += Math.floor(seconds / 60);
    seconds = seconds % 60;
  }
  // If minutes >= 60 treat as a real duration and format as H:MM:SS
  const totalMinutes = num < 0 ? -minutes : minutes;
  const sign = num < 0 ? '-' : '';
  if (Math.abs(totalMinutes) >= 60) {
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const secs = seconds;
    return `${sign}${String(hours)}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  const m = totalMinutes;
  const s = String(seconds).padStart(2, '0');
  return `${String(m)}:${s}`;
};

/**
 * Convert various duration representations into minutes (float).
 * Accepts numbers (assumed minutes if small decimal or >0 and likely minutes),
 * seconds values (if value > 1000 treat as ms, if >= 60 treat as seconds),
 * or activity objects containing common duration fields.
 */
export const durationToMinutes = (v) => {
  if (v == null) return null;
  // If passed an object like activity, search common fields
  if (typeof v === 'object') {
    const a = v;
    const candidates = [
      a.duration_min, a.durationMin, a.duration_minutes, a.durationMinutes,
      a.duration_sec, a.duration_s, a.duration_seconds, a.durationSeconds,
      a.moving_time, a.moving_time_seconds, a.moving_time_s, a.movingTime,
      a.elapsed_time, a.elapsed_time_seconds, a.elapsedTime,
      a.duration, a.time_seconds, a.time_s
    ];
    for (const c of candidates) {
      if (c == null) continue;
      const converted = durationToMinutes(c);
      if (converted != null) return converted;
    }
    return null;
  }

  // Primitive values
  const num = Number(v);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;

  // Heuristics:
  // - If value is large (>1000) treat as milliseconds
  // - If value >= 60 and < 1000 treat as seconds
  // - If value < 10 and has fractional part likely minutes decimal
  // - Otherwise if between 10 and 60 could be minutes or seconds; assume minutes if <= 300
  const abs = Math.abs(num);
  if (abs >= 1000) {
    // milliseconds
    return Math.round(num) / 1000 / 60;
  }
  if (abs >= 60) {
    // seconds
    return num / 60;
  }
  // small numbers: treat as minutes (decimal)
  return num;
};

/**
 * Compute pace in minutes per km given distance_km and duration (any form supported by durationToMinutes)
 * Returns null if input invalid.
 */
export const paceMinPerKm = (distanceKm, durationAny) => {
  const d = distanceKm == null ? null : Number(distanceKm);
  if (d == null || !Number.isFinite(d) || d <= 0) return null;
  const minutes = durationToMinutes(durationAny);
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes / d;
};

/**
 * Parse various avg pace representations into minutes-per-km float.
 * Accepts:
 * - numeric minutes (e.g. 5.25)
 * - mm:ss strings ("5:15")
 * - seconds numeric (e.g. 315 -> 5.25)
 */
export const parsePaceToMinutes = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    // If value looks like seconds (>=60) convert
    if (Math.abs(n) >= 60) return n / 60;
    return n;
  }
  if (typeof v === 'string') {
    if (v.includes(':')) {
      // support MM:SS or HH:MM:SS (possibly fractional seconds)
      const parts = v.split(':').map(p => p.trim());
      if (parts.length === 2) {
        const m = Number(parts[0]); const s = Number(parts[1]);
        if (Number.isFinite(m) && Number.isFinite(s)) return Math.abs(m) + (s / 60);
      }
      if (parts.length === 3) {
        const h = Number(parts[0]) || 0; const m = Number(parts[1]) || 0; const s = Number(parts[2]) || 0;
        if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
          const totalSeconds = Math.abs(h) * 3600 + (Number(m) * 60) + Number(s);
          return totalSeconds / 60.0;
        }
      }
    }
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) {
      if (Math.abs(n) >= 60) return n / 60;
      return n;
    }
  }
  return null;
};