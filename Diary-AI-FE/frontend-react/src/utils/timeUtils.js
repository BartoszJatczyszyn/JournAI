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