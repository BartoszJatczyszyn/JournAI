import { useMemo } from 'react';

// Simple linear regression: returns {slope, intercept, r2}
function linearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const { x, y } of points) {
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const denom = (n * sumX2 - sumX * sumX) || 1e-9;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  // r^2
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of points) {
    const pred = slope * x + intercept;
    ssTot += (y - meanY) ** 2;
    ssRes += (y - pred) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

// Exponential Weighted Moving Average
function ewma(values, alpha = 0.5) {
  if (!values.length) return null;
  let prev = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = alpha * values[i] + (1 - alpha) * prev;
  }
  return prev;
}

export const useActivityPredictions = (weeklyGroups, { window = 6, ewmaAlpha = 0.5, blend = 0.5 } = {}) => {
  return useMemo(() => {
    const weeks = weeklyGroups.slice(-window);
    // index weeks chronologically 0..k-1
    const distancePoints = weeks.filter(w => w.distance != null).map((w,i)=>({ x:i, y:w.distance }));
    const stepsPoints = weeks.filter(w => w.steps != null).map((w,i)=>({ x:i, y:w.steps }));
    const pacePoints = weeks.filter(w => w.rollingAvgPace4 != null).map((w,i)=>({ x:i, y:w.rollingAvgPace4 }));

    const distReg = distancePoints.length >= 3 ? linearRegression(distancePoints) : null;
    const stepsReg = stepsPoints.length >= 3 ? linearRegression(stepsPoints) : null;
    const paceReg = pacePoints.length >= 3 ? linearRegression(pacePoints) : null;

    const nextIndex = weeks.length; // forecast next sequential week
    const regDistance = distReg ? distReg.slope * nextIndex + distReg.intercept : null;
    const regSteps = stepsReg ? stepsReg.slope * nextIndex + stepsReg.intercept : null;
    const regPace = paceReg ? paceReg.slope * nextIndex + paceReg.intercept : null;

    // EWMA last value as naive forecast
    const ewmaDistance = ewma(distancePoints.map(p=>p.y), ewmaAlpha);
    const ewmaSteps = ewma(stepsPoints.map(p=>p.y), ewmaAlpha);
    const ewmaPace = ewma(pacePoints.map(p=>p.y), ewmaAlpha);

    // Blend regression with EWMA (if both available). For pace lower is better but blending arithmetic is fine.
    const blendVal = (regVal, ewVal) => {
      if (regVal == null && ewVal == null) return null;
      if (regVal == null) return ewVal;
      if (ewVal == null) return regVal;
      return blend * regVal + (1 - blend) * ewVal;
    };

    const predictedDistance = blendVal(regDistance, ewmaDistance);
    const predictedSteps = blendVal(regSteps, ewmaSteps);
    const predictedRollingPace = blendVal(regPace, ewmaPace);

    // Confidence heuristic: map r2 to low/medium/high thresholds
    const confLabel = (r2) => {
      if (r2 == null) return 'unknown';
      if (r2 >= 0.75) return 'high';
      if (r2 >= 0.45) return 'medium';
      return 'low';
    };

    const distanceConfidence = distReg ? confLabel(distReg.r2) : 'insufficient';
    const stepsConfidence = stepsReg ? confLabel(stepsReg.r2) : 'insufficient';
    const paceConfidence = paceReg ? confLabel(paceReg.r2) : 'insufficient';

    // Improvement pace (positive means faster) vs latest rolling average
    let paceImprovement = null;
    if (predictedRollingPace != null && pacePoints.length) {
      const last = pacePoints[pacePoints.length -1].y;
      if (last && last > 0) {
        paceImprovement = ((last - predictedRollingPace) / last) * 100; // positive => faster expected
      }
    }

    return {
      windowUsed: weeks.length,
      regression: { distReg, stepsReg, paceReg },
      components: {
        regDistance, regSteps, regPace,
        ewmaDistance, ewmaSteps, ewmaPace,
      },
      predictedDistance: predictedDistance != null ? clamp(predictedDistance, 0, 1e6) : null,
      predictedSteps: predictedSteps != null ? clamp(predictedSteps, 0, 1e9) : null,
      predictedRollingPace: predictedRollingPace != null ? clamp(predictedRollingPace, 0, 200) : null,
      distanceConfidence,
      stepsConfidence,
      paceConfidence,
      paceImprovement
    };
  }, [weeklyGroups, window, ewmaAlpha, blend]);
};

export default useActivityPredictions;
