import { useMemo } from 'react';

// Derive Monday Date from ISO week label YYYY-Www
function mondayOfIsoWeek(label) {
  const [yearStr, wPart] = label.split('-W');
  const year = Number(yearStr); const week = Number(wPart);
  // Thursday of week
  const fourthJan = new Date(Date.UTC(year,0,4));
  const fourthJanDay = (fourthJan.getUTCDay() + 6) % 7; // 0=Mon
  const week1Thu = new Date(fourthJan);
  week1Thu.setUTCDate(fourthJan.getUTCDate() - fourthJanDay + 3);
  const targetThu = new Date(week1Thu);
  targetThu.setUTCDate(week1Thu.getUTCDate() + (week -1)*7);
  const monday = new Date(targetThu);
  monday.setUTCDate(targetThu.getUTCDate() - 3);
  return monday; // UTC midnight
}

export const useGoalSimulation = (weeklyGroups, predictions, { distanceGoal, paceGoal, maxWeeks = 52 } = {}) => {
  return useMemo(() => {
    const last = weeklyGroups[weeklyGroups.length -1];
    if (!last) return { distance: null, pace: null };
    const result = { distance: null, pace: null };

    // Distance simulation using regression slope (not blended) for linear projection
    if (distanceGoal != null && predictions?.regression?.distReg && last.distance != null) {
      const slope = predictions.regression.distReg.slope; // km per week
      const current = last.distance;
      if (distanceGoal <= current) {
        result.distance = { weeks: 0, achievable: true, message: 'Already reached', etaDate: new Date() };
      } else if (slope <= 0.0001) {
        result.distance = { weeks: null, achievable: false, message: 'Trend not increasing (slope <= 0)', etaDate: null };
      } else {
        const rawWeeks = (distanceGoal - current) / slope;
        const weeks = Math.ceil(rawWeeks);
        if (weeks > maxWeeks) {
          result.distance = { weeks: null, achievable: false, message: `> ${maxWeeks} weeks (too slow trend)`, etaDate: null };
        } else {
          // Next week Monday base
          const baseMonday = mondayOfIsoWeek(last.week);
            // move to next week (start of future week index 1)
          baseMonday.setUTCDate(baseMonday.getUTCDate() + 7 * weeks);
          result.distance = { weeks, achievable: true, message: 'Projected', etaDate: baseMonday };
        }
      }
    }

    // Pace simulation (lower is better). Use pace regression slope per week.
    if (paceGoal != null && predictions?.regression?.paceReg && last.rollingAvgPace4 != null) {
      const slope = predictions.regression.paceReg.slope; // min/km per week (can be negative for improvement)
      const current = last.rollingAvgPace4;
      if (paceGoal >= current) {
        result.pace = { weeks: 0, achievable: true, message: 'Already at or better than target', etaDate: new Date() };
      } else if (slope >= -0.0001) {
        result.pace = { weeks: null, achievable: false, message: 'No improving trend (slope >= 0)', etaDate: null };
      } else {
        const rawWeeks = (paceGoal - current) / slope; // slope negative -> positive weeks
        const weeks = Math.ceil(rawWeeks);
        if (weeks > maxWeeks) {
          result.pace = { weeks: null, achievable: false, message: `> ${maxWeeks} weeks (too slow improvement)`, etaDate: null };
        } else {
          const baseMonday = mondayOfIsoWeek(last.week);
          baseMonday.setUTCDate(baseMonday.getUTCDate() + 7 * weeks);
          result.pace = { weeks, achievable: true, message: 'Projected', etaDate: baseMonday };
        }
      }
    }

    return result;
  }, [weeklyGroups, predictions, distanceGoal, paceGoal, maxWeeks]);
};

export default useGoalSimulation;
