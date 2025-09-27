#!/usr/bin/env python3
"""
Specialized Analytics Modules for Specific Health Domains
Provides domain-specific insights for sleep, stress, activity, and nutrition
"""

from datetime import datetime
import os
from statistics import mean, stdev
import math

from dotenv import load_dotenv
from db import execute_query

# Load environment variables
load_dotenv('config.env')

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'diary'),
    'user': os.getenv('DB_USER', 'diary_user'),
    'password': os.getenv('DB_PASSWORD', 'diary123')
}

def execute_query(query, params=None, fetch_one=False, fetch_all=True):
    """Execute database query safely using unified adapter"""
    try:
        from db import execute_query as _exec
        return _exec(query, params, fetch_one=fetch_one, fetch_all=fetch_all)
    except Exception:
        return None

class SleepAnalytics:
    """Specialized sleep analysis"""
    
    def analyze_sleep_efficiency(self, days=30):
        """Analyze sleep efficiency and quality patterns"""
        query = """
        SELECT 
            s.day,
            s.sleep_score,
            s.sleep_duration_seconds,
            s.deep_sleep_seconds,
            s.light_sleep_seconds,
            s.rem_sleep_seconds,
            s.awake_seconds,
            s.sleep_start,
            s.sleep_end,
            -- Next day metrics
            next_d.energy_level as next_energy,
            next_d.mood as next_mood,
            next_g.resting_heart_rate as next_rhr,
            -- Previous day activity
            prev_g.steps as prev_steps,
            prev_g.vigorous_activity_time as prev_vigorous_activity,
            prev_d.stress_level_manual as prev_stress
            -- Last activity before sleep (most recent activity with start_time <= sleep_start)
            , last_act.sport as last_activity_sport
         , last_act.duration as last_activity_duration
         , last_act.avg_hr as last_activity_avg_hr
         , last_act.start_time as last_activity_start
         , last_act.stop_time as last_activity_stop
         , last_act.last_activity_end as last_activity_end
        FROM garmin_sleep_sessions s
        LEFT JOIN LATERAL (
         SELECT sport, elapsed_time as duration, avg_hr, start_time, stop_time,
             (start_time + (elapsed_time * INTERVAL '1 second')) as last_activity_end
            FROM garmin_activities a
            WHERE a.start_time <= s.sleep_start
            ORDER BY a.start_time DESC
            LIMIT 1
        ) last_act ON TRUE
        LEFT JOIN daily_journal next_d ON s.day = next_d.day - INTERVAL '1 day'
        LEFT JOIN garmin_daily_summaries next_g ON s.day = next_g.day - INTERVAL '1 day'
        LEFT JOIN garmin_daily_summaries prev_g ON s.day = prev_g.day + INTERVAL '1 day'
        LEFT JOIN daily_journal prev_d ON s.day = prev_d.day + INTERVAL '1 day'
        WHERE s.day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_sleep_sessions) - (%s * INTERVAL '1 day')
        ORDER BY s.day DESC
        """

        data = execute_query(query, (days,))
        if not data:
            return {}

        # Calculate sleep metrics
        sleep_scores = [d['sleep_score'] for d in data if d.get('sleep_score') is not None]

        # Clamp helper
        def _clamp01(x):
            try:
                return max(0.0, min(100.0, float(x)))
            except Exception:
                return None

        # Compute efficiency per-row using timestamps and seconds fields for robustness
        sleep_efficiencies = []

        # Helper to normalize possible seconds/minutes/milliseconds fields to minutes (float)
        def _field_to_minutes(row, seconds_key, minutes_key=None):
            # Prefer explicit seconds field, then minutes field
            val = row.get(seconds_key)
            if val is not None:
                try:
                    v = float(val)
                    # Heuristic: if value looks like milliseconds (very large), convert to seconds first
                    if v > 100000:
                        v = v / 1000.0
                    # Assume the seconds field is in seconds; convert to minutes
                    return v / 60.0
                except Exception:
                    pass
            if minutes_key:
                mv = row.get(minutes_key)
                if mv is not None:
                    try:
                        return float(mv)
                    except Exception:
                        pass
            return 0.0

        for d in data:
            try:
                dur = d.get('sleep_duration_seconds')
                deep = d.get('deep_sleep_seconds') or 0
                light = d.get('light_sleep_seconds') or 0
                rem = d.get('rem_sleep_seconds') or 0
                awake = d.get('awake_seconds') or 0

                # Prefer time-in-bed computed from timestamps when available
                tib = None
                start_ts = d.get('sleep_start')
                end_ts = d.get('sleep_end')
                if start_ts and end_ts:
                    try:
                        tib = (end_ts - start_ts).total_seconds()
                        if tib <= 0:
                            tib += 24 * 60 * 60
                    except Exception:
                        tib = None

                # Numerator: prefer sum of stages if present, else use reported duration minus awake when sensible
                stages_sum = (deep or 0) + (light or 0) + (rem or 0)
                asleep = None
                used_stage_sum = False
                if stages_sum and stages_sum > 0:
                    asleep = stages_sum
                    used_stage_sum = True
                elif dur is not None:
                    if awake and awake > 0 and dur >= awake:
                        asleep = float(dur) - float(awake)
                    else:
                        # don't use raw duration alone unless we have a denominator (tib) or awake info
                        asleep = float(dur) if (tib and tib > 0) or (awake and awake > 0) else None

                # Denominator: prefer tib, otherwise use dur+awake when that makes sense
                denom = None
                if tib and tib > 0:
                    denom = tib
                elif dur is not None and awake is not None and (dur + awake) > 0:
                    denom = float(dur) + float(awake)

                eff = None
                eff_source = None
                if asleep is not None and denom is not None and denom > 0:
                    # determine numerator source
                    if used_stage_sum:
                        num_src = 'stages'
                    elif dur is not None:
                        num_src = 'duration'
                    else:
                        num_src = 'unknown'

                    # determine denominator source
                    if tib and tib > 0:
                        denom_src = 'tib'
                    elif dur is not None and awake is not None and (dur + awake) > 0:
                        denom_src = 'duration_plus_awake'
                    else:
                        denom_src = 'unknown'

                    eff_raw = (float(asleep) / float(denom)) * 100.0
                    eff = _clamp01(round(eff_raw, 1))
                    eff_source = f"{num_src}/{denom_src}"

                    # If we got 100% but stage-sum is available and smaller than denom, prefer stage-sum-based numerator
                    if eff == 100.0 and not used_stage_sum and stages_sum and stages_sum > 0 and stages_sum < denom:
                        eff_raw2 = (float(stages_sum) / float(denom)) * 100.0
                        eff = _clamp01(round(eff_raw2, 1))
                        eff_source = f"stages/{denom_src}"

                    # Heuristic guard: if efficiency == 100 but there's no awake data and no stage breakdown,
                    # and numerator came from raw duration (i.e. not stage sum), treat as unknown (None)
                    if eff == 100.0 and not used_stage_sum and (awake is None or float(awake) == 0.0):
                        try:
                            if tib is not None and dur is not None and abs(float(tib) - float(dur)) < 60:
                                eff = None
                                eff_source = None
                        except Exception:
                            pass

                d['sleep_efficiency'] = eff
                # store source for downstream visibility
                d['sleep_efficiency_source'] = eff_source
                if eff is not None:
                    sleep_efficiencies.append(eff)
            except Exception:
                d['sleep_efficiency'] = None

        deep_sleep_percentages = []
        rem_sleep_percentages = []

        for d in data:
            tib_min = None
            if d.get('sleep_start') and d.get('sleep_end'):
                try:
                    tib_s = (d['sleep_end'] - d['sleep_start']).total_seconds()
                    if tib_s <= 0:
                        tib_s += 24 * 60 * 60
                    tib_min = tib_s / 60.0
                except Exception:
                    tib_min = None
            if tib_min is None and d.get('sleep_duration_seconds') is not None:
                tib_min = float(d.get('sleep_duration_seconds')) / 60.0

            if tib_min and tib_min > 0:
                deep_min = _field_to_minutes(d, 'deep_sleep_seconds', 'deep_sleep_minutes')
                rem_min = _field_to_minutes(d, 'rem_sleep_seconds', 'rem_sleep_minutes')
                if deep_min > 0:
                    deep_sleep_percentages.append(max(0.0, min(100.0, float(deep_min / tib_min * 100))))
                if rem_min > 0:
                    rem_sleep_percentages.append(max(0.0, min(100.0, float(rem_min / tib_min * 100))))

        # Normalize rows with computed fields for downstream analyses
        norm_rows = []
        for d in data:
            eff = _clamp01(d.get('sleep_efficiency')) if d.get('sleep_efficiency') is not None else None

            tib_min = None
            if d.get('sleep_start') and d.get('sleep_end'):
                try:
                    tib_s = (d['sleep_end'] - d['sleep_start']).total_seconds()
                    if tib_s <= 0:
                        tib_s += 24 * 60 * 60
                    tib_min = tib_s / 60.0
                except Exception:
                    tib_min = None
            if tib_min is None and d.get('sleep_duration_seconds') is not None:
                tib_min = float(d.get('sleep_duration_seconds')) / 60.0

            deep_min = float(_field_to_minutes(d, 'deep_sleep_seconds', 'deep_sleep_minutes'))
            rem_min = float(_field_to_minutes(d, 'rem_sleep_seconds', 'rem_sleep_minutes'))
            light_min = float(_field_to_minutes(d, 'light_sleep_seconds', 'light_sleep_minutes'))
            awake_min = float(_field_to_minutes(d, 'awake_seconds', 'awake_minutes'))

            deep_pct = max(0.0, min(100.0, (deep_min / tib_min * 100))) if tib_min and tib_min > 0 else None
            rem_pct = max(0.0, min(100.0, (rem_min / tib_min * 100))) if tib_min and tib_min > 0 else None

            def to_minutes(dtobj, adjust_bed=False):
                if not dtobj:
                    return None
                try:
                    time_obj = None
                    if isinstance(dtobj, str):
                        try:
                            time_obj = datetime.strptime(dtobj, '%H:%M:%S').time()
                        except Exception:
                            try:
                                dt = datetime.fromisoformat(dtobj)
                                time_obj = dt.time()
                            except Exception:
                                time_obj = None
                    else:
                        if hasattr(dtobj, 'time'):
                            time_obj = dtobj.time()
                        else:
                            time_obj = dtobj

                    if not time_obj:
                        return None
                    minutes = time_obj.hour * 60 + time_obj.minute
                    if adjust_bed and minutes < 12 * 60:
                        return minutes + 24 * 60
                    return minutes
                except Exception:
                    return None

            bed_min = to_minutes(d.get('sleep_start'), adjust_bed=True)
            wake_min = to_minutes(d.get('sleep_end'))

            norm_rows.append({
                'day': d.get('day'),
                'sleep_score': d.get('sleep_score'),
                # Backwards compatible field (0-100)
                'efficiency': eff,
                # Explicit percent value and source for clarity
                'efficiency_pct': eff,
                'sleep_efficiency': eff,
                'efficiency_source': d.get('sleep_efficiency_source'),
                'sleep_efficiency_source': d.get('sleep_efficiency_source'),
                'time_in_bed_minutes': tib_min if tib_min and tib_min > 0 else None,
                'deep_minutes': deep_min if tib_min and tib_min > 0 else None,
                'light_minutes': light_min if tib_min and tib_min > 0 else None,
                'rem_minutes': rem_min if tib_min and tib_min > 0 else None,
                'awake_minutes': awake_min if tib_min and tib_min > 0 else None,
                'deep_pct': deep_pct,
                'rem_pct': rem_pct,
                'bedtime_minutes': bed_min,
                'wake_minutes': wake_min,
                'next_energy': d.get('next_energy'),
                'next_rhr': d.get('next_rhr'),
                'next_mood': d.get('next_mood'),
                'prev_steps': d.get('prev_steps'),
                'prev_vigorous_activity': d.get('prev_vigorous_activity'),
                'prev_stress': d.get('prev_stress'),
                'last_activity_sport': d.get('last_activity_sport'),
                'last_activity_duration': d.get('last_activity_duration'),
                'last_activity_avg_hr': d.get('last_activity_avg_hr'),
                'last_activity_start': d.get('last_activity_start'),
                'last_activity_end': d.get('last_activity_end'),
            })
        
        analysis = {
            'sleep_quality_metrics': {
                'sample_size': len(data),
                'avg_sleep_score': round(mean(sleep_scores), 1) if sleep_scores else None,
                'avg_sleep_efficiency': round(mean(sleep_efficiencies), 1) if sleep_efficiencies else None,
                'avg_deep_sleep_percentage': round(mean(deep_sleep_percentages), 1) if deep_sleep_percentages else None,
                'avg_rem_sleep_percentage': round(mean(rem_sleep_percentages), 1) if rem_sleep_percentages else None,
                'sleep_consistency': round(100 - (stdev(sleep_scores) / mean(sleep_scores) * 100), 1) if len(sleep_scores) > 1 else 100
            },
            'sleep_impact_analysis': self._analyze_sleep_impact(data),
            'sleep_timing_analysis': self._analyze_sleep_timing(data),
            'timeseries': self._build_sleep_timeseries(norm_rows),
            'correlations_detail': self._correlate_sleep_with_context(norm_rows),
            'avg_sleep_duration_minutes': round(mean([d['time_in_bed_minutes'] for d in data if d.get('time_in_bed_minutes')]), 1) if any(d.get('time_in_bed_minutes') for d in data) else None,
            'sleep_recommendations': []
        }
        
        # Generate recommendations
        analysis['sleep_recommendations'] = self._generate_sleep_recommendations(analysis)
        
        return analysis
    
    def _analyze_sleep_impact(self, data):
        """Analyze how sleep affects next-day performance with correlations and diagnostics"""
        # Prepare vectors for correlations (only rows with both values)
        pairs_energy = [(d['sleep_score'], d['next_energy']) for d in data if d.get('sleep_score') is not None and d.get('next_energy') is not None]
        pairs_rhr = [(d['sleep_score'], d['next_rhr']) for d in data if d.get('sleep_score') is not None and d.get('next_rhr') is not None]
        
        def _pearson(xy):
            try:
                if len(xy) < 3:
                    return None
                xs, ys = zip(*xy)
                mx, my = mean(xs), mean(ys)
                num = sum((x - mx) * (y - my) for x, y in xy)
                denx = sum((x - mx) ** 2 for x in xs)
                deny = sum((y - my) ** 2 for y in ys)
                denom = (denx * deny) ** 0.5
                if denom == 0:
                    return None
                return round(num / denom, 3)
            except Exception:
                return None
        
        correlations = {
            'sleep_score_vs_next_energy': _pearson(pairs_energy),
            'sleep_score_vs_next_rhr': _pearson(pairs_rhr),
            'samples_energy': len(pairs_energy),
            'samples_rhr': len(pairs_rhr)
        }
        
        # Previous high/low split logic retained for intuitive diffs
        high_quality_sleep = []
        low_quality_sleep = []
        for d in data:
            if d.get('sleep_score') is not None and d.get('next_energy') is not None:
                if d['sleep_score'] >= 80:
                    high_quality_sleep.append({'energy': d['next_energy'], 'mood': d.get('next_mood') or 0, 'rhr': d.get('next_rhr') or 0})
                elif d['sleep_score'] <= 60:
                    low_quality_sleep.append({'energy': d['next_energy'], 'mood': d.get('next_mood') or 0, 'rhr': d.get('next_rhr') or 0})
        
        impact_analysis = {'correlations': correlations}
        
        if high_quality_sleep and low_quality_sleep:
            high_energy = mean([s['energy'] for s in high_quality_sleep])
            low_energy = mean([s['energy'] for s in low_quality_sleep])
            impact_analysis.update({
                'energy_difference': round(high_energy - low_energy, 1),
                'high_quality_avg_energy': round(high_energy, 1),
                'low_quality_avg_energy': round(low_energy, 1),
                'sample_sizes': {
                    'high_quality_nights': len(high_quality_sleep),
                    'low_quality_nights': len(low_quality_sleep)
                }
            })
        
        # Minimal diagnostics if data is scarce
        if correlations['samples_energy'] < 3 and correlations['samples_rhr'] < 3:
            impact_analysis['diagnostics'] = {'insufficient_data': True}
        
        return impact_analysis
    
    def _build_sleep_timeseries(self, rows):
        """Return compact time series useful for charts."""
        ts = []
        for r in rows:
            ts.append({
                'day': r.get('day').isoformat() if hasattr(r.get('day'), 'isoformat') else r.get('day'),
                'sleep_score': r.get('sleep_score'),
                'efficiency': r.get('efficiency'),
                'time_in_bed_minutes': r.get('time_in_bed_minutes'),
                'deep_minutes': r.get('deep_minutes'),
                'light_minutes': r.get('light_minutes'),
                'rem_minutes': r.get('rem_minutes'),
                'awake_minutes': r.get('awake_minutes'),
                'deep_pct': r.get('deep_pct'),
                'rem_pct': r.get('rem_pct'),
                'next_mood': r.get('next_mood'),
                'bedtime_minutes': r.get('bedtime_minutes'),
                'wake_minutes': r.get('wake_minutes'),
                'next_energy': r.get('next_energy'),
                'next_rhr': r.get('next_rhr'),
                'prev_steps': r.get('prev_steps'),
                'prev_vigorous_activity': r.get('prev_vigorous_activity'),
                'prev_stress': r.get('prev_stress'),
                'last_activity_sport': r.get('last_activity_sport'),
                'last_activity_duration': r.get('last_activity_duration'),
                'last_activity_avg_hr': r.get('last_activity_avg_hr'),
                'last_activity_start': r.get('last_activity_start'),
                'last_activity_end': r.get('last_activity_end'),
            })
        # sort descending by day similar to query ordering
        try:
            ts.sort(key=lambda x: x['day'], reverse=True)
        except Exception:
            pass
        return ts

    def _correlate_sleep_with_context(self, rows):
        """Compute multiple correlations to support charts and insights."""
        # Helper to build pairs filtering None
        def pairs(a_key, b_key):
            p = [(r.get(a_key), r.get(b_key)) for r in rows]
            p = [(a, b) for a, b in p if a is not None and b is not None]
            return p
        
        def pearson(p):
            try:
                if len(p) < 3:
                    return None
                xs, ys = zip(*p)
                mx, my = mean(xs), mean(ys)
                num = sum((x - mx)*(y - my) for x, y in p)
                denx = sum((x - mx)**2 for x in xs)
                deny = sum((y - my)**2 for y in ys)
                denom = (denx*deny) ** 0.5
                if denom == 0:
                    return None
                return round(num/denom, 3)
            except Exception:
                return None
        
        metrics = [
            ('sleep_score','next_energy'),
            ('sleep_score','next_rhr'),
            ('sleep_score','next_mood'),
            ('efficiency','next_energy'),
            ('efficiency','next_rhr'),
            ('efficiency','next_mood'),
            ('deep_pct','sleep_score'),
            ('rem_pct','sleep_score'),
            ('time_in_bed_minutes','sleep_score'),
            ('time_in_bed_minutes','next_mood'),
            ('last_activity_duration','sleep_score'),
            ('last_activity_avg_hr','sleep_score'),
            ('last_activity_duration','efficiency'),
            ('last_activity_avg_hr','efficiency'),
            ('prev_steps','sleep_score'),
            ('prev_vigorous_activity','sleep_score'),
            ('prev_stress','sleep_score'),
        ]
        detail = {}
        for a, b in metrics:
            pr = pearson(pairs(a, b))
            detail[f'{a}_vs_{b}'] = pr
        return {
            'pearson': detail,
            'samples': { k: len([(r.get(a), r.get(b)) for r in rows if r.get(a) is not None and r.get(b) is not None]) for a,b in metrics for k in [f'{a}_vs_{b}'] }
        }

    def _analyze_sleep_timing(self, data):
        """Analyze sleep timing patterns using circular statistics and provide windows and recommendations.

        Returns keys (when data available):
        - avg_bedtime_label: 'HH:MM'
        - avg_bedtime_circular: minutes [0,1440)
        - avg_bedtime_window: { start_minutes, end_minutes, start_label, end_label, label }
        - bedtime_consistency: [0..100] derived from circular resultant length
        - avg_wake_time_label, avg_wake_time_circular, avg_wake_window, wake_consistency
        - recommended_bedtime_label, recommended_bedtime_minutes, recommended_bedtime_window
        - samples: { bedtimes: n, wake_times: n }
        """
        import math

        def _to_time_obj(val):
            try:
                if isinstance(val, str):
                    # Try HH:MM:SS then ISO
                    try:
                        return datetime.strptime(val, '%H:%M:%S').time()
                    except Exception:
                        try:
                            return datetime.fromisoformat(val).time()
                        except Exception:
                            return None
                else:
                    if hasattr(val, 'time'):
                        return val.time()
                    return val
            except Exception:
                return None

        def _to_minutes_of_day(val):
            t = _to_time_obj(val)
            if not t:
                return None
            return int(t.hour) * 60 + int(t.minute)

        # Gather minutes-of-day (mod 1440) without shifting by +24h; circular mean will handle wrap-around
        bed_mod = []
        wake_mod = []
        for d in data:
            st = d.get('sleep_start_time') or d.get('sleep_start')
            en = d.get('sleep_end_time') or d.get('sleep_end')
            mm_b = _to_minutes_of_day(st)
            mm_w = _to_minutes_of_day(en)
            if mm_b is not None:
                bed_mod.append(((mm_b % 1440) + 1440) % 1440)
            if mm_w is not None:
                wake_mod.append(((mm_w % 1440) + 1440) % 1440)

        def _circular_stats(mins_list):
            vals = [((int(m) % 1440) + 1440) % 1440 for m in mins_list if m is not None]
            n = len(vals)
            if n == 0:
                return None
            # Map to angles
            to_rad = lambda deg: deg * math.pi / 180.0
            cos_sum = 0.0
            sin_sum = 0.0
            for m in vals:
                ang_deg = (m / 1440.0) * 360.0
                cos_sum += math.cos(to_rad(ang_deg))
                sin_sum += math.sin(to_rad(ang_deg))
            cos_avg = cos_sum / n
            sin_avg = sin_sum / n
            # Mean angle
            ang = math.atan2(sin_avg, cos_avg)  # radians
            ang_deg = (ang * 180.0 / math.pi + 360.0) % 360.0
            mean_min = int(round((ang_deg / 360.0) * 1440.0)) % 1440
            # Resultant length (0..1): higher -> more consistent
            R = math.hypot(cos_avg, sin_avg)
            consistency = round(R * 100.0, 1)
            return {
                'mean_min': mean_min,
                'consistency_pct': consistency,
                'n': n,
            }

        def _label(m):
            h = (m // 60) % 24
            mi = m % 60
            return f"{h:02d}:{mi:02d}"

        def _window(center_min, plus_minus=30):
            c = ((int(center_min) % 1440) + 1440) % 1440
            start = ((c - plus_minus) % 1440 + 1440) % 1440
            end = ((c + plus_minus) % 1440 + 1440) % 1440
            return {
                'start_minutes': start,
                'end_minutes': end,
                'start_label': _label(start),
                'end_label': _label(end),
                'label': f"{_label(start)}–{_label(end)}"
            }

        timing_analysis = {
            'samples': {
                'bedtimes': len(bed_mod),
                'wake_times': len(wake_mod),
            }
        }

        # Bedtime circular stats
        bed_stats = _circular_stats(bed_mod)
        if bed_stats:
            mean_b = bed_stats['mean_min']
            timing_analysis['avg_bedtime_circular'] = mean_b
            timing_analysis['avg_bedtime_label'] = _label(mean_b)
            timing_analysis['bedtime_consistency'] = bed_stats['consistency_pct']
            timing_analysis['avg_bedtime_window'] = _window(mean_b, 30)

        # Wake time circular stats
        wake_stats = _circular_stats(wake_mod)
        if wake_stats:
            mean_w = wake_stats['mean_min']
            timing_analysis['avg_wake_time_circular'] = mean_w
            timing_analysis['avg_wake_time_label'] = _label(mean_w)
            timing_analysis['wake_consistency'] = wake_stats['consistency_pct']
            timing_analysis['avg_wake_window'] = _window(mean_w, 30)

        # Recommended bedtime (~7.5h before wake mean) if wake mean is available
        if wake_stats:
            target_min = int(round(7.5 * 60))
            rec_bed = (wake_stats['mean_min'] - target_min) % 1440
            timing_analysis['recommended_bedtime_minutes'] = rec_bed
            timing_analysis['recommended_bedtime_label'] = _label(rec_bed)
            timing_analysis['recommended_bedtime_window'] = _window(rec_bed, 30)

        return timing_analysis
    
    def _generate_sleep_recommendations(self, analysis):
        """Generate sleep-specific recommendations"""
        recommendations = []
        
        sleep_metrics = analysis.get('sleep_quality_metrics', {})
        
        if sleep_metrics.get('avg_sleep_score', 0) < 70:
            recommendations.append("Focus on improving overall sleep quality")
        
        if sleep_metrics.get('avg_sleep_efficiency', 0) < 85:
            recommendations.append("Work on sleep efficiency - reduce time awake in bed")
        
        if sleep_metrics.get('avg_deep_sleep_percentage', 0) < 15:
            recommendations.append("Optimize deep sleep through consistent bedtime and cool environment")
        
        timing = analysis.get('sleep_timing_analysis', {})
        if timing.get('bedtime_consistency', 100) < 80:
            recommendations.append("Maintain more consistent bedtime schedule")
        
        return recommendations

class StressAnalytics:
    """Specialized stress analysis"""
    
    def analyze_stress_patterns(self, days=30):
        """Comprehensive stress pattern analysis"""
        query = """
        SELECT 
            day,
            EXTRACT(HOUR FROM ts) as hour,
            EXTRACT(DOW FROM ts) as day_of_week,
            stress
        FROM garmin_stress_data 
        WHERE day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_stress_data) - (%s * INTERVAL '1 day')
        ORDER BY ts
        """
        
        stress_data = execute_query(query, (days,))
        if not stress_data:
            return {}
        
        analysis = {
            'hourly_patterns': self._analyze_hourly_stress(stress_data),
            'daily_patterns': self._analyze_daily_stress_patterns(stress_data),
            'stress_triggers': self._identify_stress_triggers(stress_data),
            'recovery_patterns': self._analyze_stress_recovery(stress_data),
            'stress_recommendations': []
        }
        
        analysis['stress_recommendations'] = self._generate_stress_recommendations(analysis)
        
        return analysis
    
    def _analyze_hourly_stress(self, data):
        """Analyze stress patterns by hour of day"""
        hourly_stress = {}
        for record in data:
            hour = int(record['hour'])
            if hour not in hourly_stress:
                hourly_stress[hour] = []
            hourly_stress[hour].append(record['stress'])
        
        hourly_analysis = {}
        for hour, values in hourly_stress.items():
            if values:
                hourly_analysis[hour] = {
                    'avg_stress': round(mean(values), 1),
                    'max_stress': max(values),
                    'stress_episodes': len([v for v in values if v > 75]),
                    'measurements': len(values)
                }
        
        # Find peak stress periods
        if hourly_analysis:
            peak_hour = max(hourly_analysis.keys(), key=lambda h: hourly_analysis[h]['avg_stress'])
            calm_hour = min(hourly_analysis.keys(), key=lambda h: hourly_analysis[h]['avg_stress'])
            
            return {
                'hourly_breakdown': hourly_analysis,
                'peak_stress_hour': peak_hour,
                'calmest_hour': calm_hour,
                'peak_stress_value': hourly_analysis[peak_hour]['avg_stress'],
                'lowest_stress_value': hourly_analysis[calm_hour]['avg_stress']
            }
        
        return {}
    
    def _analyze_daily_stress_patterns(self, data):
        """Analyze stress patterns by day of week"""
        day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        daily_stress = {i: [] for i in range(7)}
        
        for record in data:
            dow = int(record['day_of_week'])
            daily_stress[dow].append(record['stress'])
        
        daily_analysis = {}
        for dow, values in daily_stress.items():
            if values:
                daily_analysis[day_names[dow]] = {
                    'avg_stress': round(mean(values), 1),
                    'high_stress_episodes': len([v for v in values if v > 75]),
                    'stress_variability': round(stdev(values), 1) if len(values) > 1 else 0
                }
        
        return daily_analysis
    
    def _identify_stress_triggers(self, data):
        """Identify potential stress triggers and patterns"""
        # Group consecutive high stress periods
        high_stress_episodes = []
        current_episode = []
        
        for record in data:
            if record['stress'] > 75:
                current_episode.append(record)
            else:
                if len(current_episode) >= 3:  # At least 3 consecutive high stress readings
                    high_stress_episodes.append(current_episode)
                current_episode = []
        
        # Add final episode if exists
        if len(current_episode) >= 3:
            high_stress_episodes.append(current_episode)
        
        triggers = {
            'total_high_stress_episodes': len(high_stress_episodes),
            'avg_episode_duration': round(mean([len(ep) for ep in high_stress_episodes]), 1) if high_stress_episodes else 0,
            'common_trigger_times': []
        }
        
        # Find common times for stress episodes
        episode_hours = []
        for episode in high_stress_episodes:
            start_hour = episode[0]['hour']
            episode_hours.append(start_hour)
        
        if episode_hours:
            from collections import Counter
            hour_counts = Counter(episode_hours)
            triggers['common_trigger_times'] = [
                {'hour': hour, 'frequency': count} 
                for hour, count in hour_counts.most_common(3)
            ]
        
        return triggers
    
    def _analyze_stress_recovery(self, data):
        """Analyze how quickly stress levels recover"""
        recovery_times = []
        
        for i, record in enumerate(data[:-1]):
            if record['stress'] > 75:  # High stress
                # Look for recovery in next readings
                for j in range(i + 1, min(i + 13, len(data))):  # Look ahead up to ~3 hours
                    if data[j]['stress'] < 50:  # Recovered to low stress
                        recovery_time = j - i
                        recovery_times.append(recovery_time)
                        break
        
        if recovery_times:
            return {
                'avg_recovery_time_readings': round(mean(recovery_times), 1),
                'fast_recovery_episodes': len([r for r in recovery_times if r <= 4]),
                'slow_recovery_episodes': len([r for r in recovery_times if r > 8]),
                'recovery_consistency': round(100 - (stdev(recovery_times) / mean(recovery_times) * 100), 1) if len(recovery_times) > 1 else 100
            }
        
        return {}
    
    def _generate_stress_recommendations(self, analysis):
        """Generate stress management recommendations"""
        recommendations = []
        
        hourly = analysis.get('hourly_patterns', {})
        if hourly.get('peak_stress_hour'):
            peak_hour = hourly['peak_stress_hour']
            recommendations.append(f"Plan stress management techniques around {peak_hour}:00")
        
        triggers = analysis.get('stress_triggers', {})
        if triggers.get('total_high_stress_episodes', 0) > 5:
            recommendations.append("Consider stress reduction techniques - frequent high stress episodes detected")
        
        recovery = analysis.get('recovery_patterns', {})
        if recovery.get('slow_recovery_episodes', 0) > recovery.get('fast_recovery_episodes', 0):
            recommendations.append("Focus on stress recovery techniques - slow recovery pattern detected")
        
        return recommendations

class ActivityAnalytics:
    """Specialized activity and fitness analysis"""
    
    def analyze_activity_patterns(self, days=30):
        """Comprehensive activity pattern analysis"""
        query = """
        SELECT 
            g.day,
            g.steps,
            g.calories_burned,
            g.distance,
            g.floors_up,
            g.moderate_activity_time,
            g.vigorous_activity_time,
            g.rhr,
            -- Activity intensity calculation
            CASE 
                WHEN g.vigorous_activity_time > 60 THEN 'high'
                WHEN g.moderate_activity_time > 30 OR g.vigorous_activity_time > 20 THEN 'moderate'
                ELSE 'low'
            END as activity_intensity,
            -- Next day recovery indicators
            next_g.rhr as next_rhr,
            next_d.energy_level as next_energy,
            next_d.mood as next_mood,
            -- Sleep quality after activity
            s.sleep_score,
            s.deep_sleep,
            -- Activities data
            a.sport,
            a.duration,
            a.avg_hr,
            a.max_hr
        FROM garmin_daily_summaries g
        LEFT JOIN garmin_daily_summaries next_g ON g.day = next_g.day - INTERVAL '1 day'
        LEFT JOIN daily_journal next_d ON g.day = next_d.day - INTERVAL '1 day'
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN garmin_activities a ON g.day = DATE(a.start_time)
        WHERE g.day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_daily_summaries) - (%s * INTERVAL '1 day')
        AND g.steps IS NOT NULL
        ORDER BY g.day DESC
        """
        
        data = execute_query(query, (days,))
        if not data:
            return {}
        
        analysis = {
            'activity_metrics': self._calculate_activity_metrics(data),
            'intensity_analysis': self._analyze_activity_intensity(data),
            'recovery_correlation': self._analyze_activity_recovery(data),
            'activity_consistency': self._analyze_activity_consistency(data),
            'sport_analysis': self._analyze_sport_patterns(data),
            'activity_recommendations': []
        }
        
        analysis['activity_recommendations'] = self._generate_activity_recommendations(analysis)
        
        return analysis
    
    def _calculate_activity_metrics(self, data):
        """Calculate basic activity metrics"""
        steps_data = [d['steps'] for d in data if d['steps']]
        calories_data = [d['calories_burned'] for d in data if d['calories_burned']]
        distance_data = [d['distance'] for d in data if d['distance']]
        
        return {
            'avg_daily_steps': round(mean(steps_data), 0) if steps_data else 0,
            'avg_daily_calories': round(mean(calories_data), 0) if calories_data else 0,
            'avg_daily_distance': round(mean(distance_data), 2) if distance_data else 0,
            'step_consistency': round(100 - (stdev(steps_data) / mean(steps_data) * 100), 1) if len(steps_data) > 1 else 100,
            'active_days': len([d for d in data if d['steps'] and d['steps'] > 8000]),
            'highly_active_days': len([d for d in data if d['steps'] and d['steps'] > 15000])
        }
    
    def _analyze_activity_intensity(self, data):
        """Analyze activity intensity patterns"""
        intensity_counts = {'high': 0, 'moderate': 0, 'low': 0}
        intensity_recovery = {'high': [], 'moderate': [], 'low': []}
        
        for d in data:
            intensity = d.get('activity_intensity', 'low')
            intensity_counts[intensity] += 1
            
            if d.get('next_energy'):
                intensity_recovery[intensity].append(d['next_energy'])
        
        # Calculate recovery by intensity
        recovery_by_intensity = {}
        for intensity, energies in intensity_recovery.items():
            if energies:
                recovery_by_intensity[intensity] = round(mean(energies), 1)
        
        return {
            'intensity_distribution': intensity_counts,
            'recovery_by_intensity': recovery_by_intensity,
            'optimal_intensity': max(recovery_by_intensity, key=recovery_by_intensity.get) if recovery_by_intensity else None
        }
    
    def _analyze_activity_recovery(self, data):
        """Analyze relationship between activity and recovery"""
        high_activity_days = []
        low_activity_days = []
        
        for d in data:
            if d['steps'] and d['next_rhr'] and d['next_energy']:
                if d['steps'] > 15000:  # High activity
                    high_activity_days.append({
                        'next_rhr': d['next_rhr'],
                        'next_energy': d['next_energy'],
                        'sleep_score': d['sleep_score'] or 0
                    })
                elif d['steps'] < 8000:  # Low activity
                    low_activity_days.append({
                        'next_rhr': d['next_rhr'],
                        'next_energy': d['next_energy'],
                        'sleep_score': d['sleep_score'] or 0
                    })
        
        recovery_analysis = {}
        if high_activity_days and low_activity_days:
            high_avg_rhr = mean([d['next_rhr'] for d in high_activity_days])
            low_avg_rhr = mean([d['next_rhr'] for d in low_activity_days])
            
            high_avg_energy = mean([d['next_energy'] for d in high_activity_days])
            low_avg_energy = mean([d['next_energy'] for d in low_activity_days])
            
            recovery_analysis = {
                'rhr_difference': round(high_avg_rhr - low_avg_rhr, 1),
                'energy_difference': round(high_avg_energy - low_avg_energy, 1),
                'high_activity_recovery': {
                    'avg_next_rhr': round(high_avg_rhr, 1),
                    'avg_next_energy': round(high_avg_energy, 1),
                    'sample_size': len(high_activity_days)
                },
                'low_activity_recovery': {
                    'avg_next_rhr': round(low_avg_rhr, 1),
                    'avg_next_energy': round(low_avg_energy, 1),
                    'sample_size': len(low_activity_days)
                }
            }
        
        return recovery_analysis
    
    def _analyze_activity_consistency(self, data):
        """Analyze activity consistency patterns"""
        weekly_steps = {}
        current_week = None
        week_steps = []
        
        for d in data:
            if d['day'] and d['steps']:
                week_num = d['day'].isocalendar()[1] if hasattr(d['day'], 'isocalendar') else 1
                
                if current_week != week_num:
                    if week_steps:
                        weekly_steps[current_week] = sum(week_steps)
                    current_week = week_num
                    week_steps = []
                
                week_steps.append(d['steps'])
        
        # Add final week
        if week_steps and current_week:
            weekly_steps[current_week] = sum(week_steps)
        
        if len(weekly_steps) > 1:
            weekly_totals = list(weekly_steps.values())
            return {
                'avg_weekly_steps': round(mean(weekly_totals), 0),
                'weekly_consistency': round(100 - (stdev(weekly_totals) / mean(weekly_totals) * 100), 1),
                'weeks_analyzed': len(weekly_steps)
            }
        
        return {}
    
    def _analyze_sport_patterns(self, data):
        """Analyze specific sport/activity patterns"""
        sports_data = {}
        
        for d in data:
            if d.get('sport') and d.get('duration'):
                sport = d['sport']
                if sport not in sports_data:
                    sports_data[sport] = {
                        'sessions': 0,
                        'total_duration': 0,
                        'avg_hr': [],
                        'max_hr': []
                    }
                
                sports_data[sport]['sessions'] += 1
                sports_data[sport]['total_duration'] += d['duration'] if isinstance(d['duration'], int | float) else 0
                
                if d.get('avg_hr'):
                    sports_data[sport]['avg_hr'].append(d['avg_hr'])
                if d.get('max_hr'):
                    sports_data[sport]['max_hr'].append(d['max_hr'])
        
        # Calculate averages
        sport_analysis = {}
        for sport, data in sports_data.items():
            sport_analysis[sport] = {
                'total_sessions': data['sessions'],
                'total_duration_minutes': data['total_duration'],
                'avg_session_duration': round(data['total_duration'] / data['sessions'], 1) if data['sessions'] > 0 else 0,
                'avg_heart_rate': round(mean(data['avg_hr']), 1) if data['avg_hr'] else None,
                'avg_max_heart_rate': round(mean(data['max_hr']), 1) if data['max_hr'] else None
            }
        
        return sport_analysis
    
    def _generate_activity_recommendations(self, analysis):
        """Generate activity-specific recommendations"""
        recommendations = []
        
        metrics = analysis.get('activity_metrics', {})
        if metrics.get('avg_daily_steps', 0) < 8000:
            recommendations.append("Increase daily step target - currently below recommended 8,000 steps")
        
        if metrics.get('step_consistency', 100) < 70:
            recommendations.append("Focus on activity consistency - large day-to-day variations detected")
        
        intensity = analysis.get('intensity_analysis', {})
        if intensity.get('optimal_intensity'):
            optimal = intensity['optimal_intensity']
            recommendations.append(f"Optimal activity intensity appears to be '{optimal}' based on recovery data")
        
        recovery = analysis.get('recovery_correlation', {})
        if recovery.get('rhr_difference', 0) > 5:
            recommendations.append("Consider recovery days after high activity - elevated RHR detected")
        
        return recommendations

def main():
    """Test specialized analytics modules"""
    print("🧠 Testing specialized analytics modules...")
    
    sleep_analytics = SleepAnalytics()
    stress_analytics = StressAnalytics()
    activity_analytics = ActivityAnalytics()
    
    print("\n😴 Sleep Analysis:")
    sleep_results = sleep_analytics.analyze_sleep_efficiency(30)
    if sleep_results.get('sleep_quality_metrics'):
        print(f"  Average sleep score: {sleep_results['sleep_quality_metrics'].get('avg_sleep_score', 'N/A')}")
    
    print("\n😰 Stress Analysis:")
    stress_results = stress_analytics.analyze_stress_patterns(30)
    if stress_results.get('hourly_patterns'):
        print(f"  Peak stress hour: {stress_results['hourly_patterns'].get('peak_stress_hour', 'N/A')}")
    
    print("\n🏃 Activity Analysis:")
    activity_results = activity_analytics.analyze_activity_patterns(30)
    if activity_results.get('activity_metrics'):
        print(f"  Average daily steps: {activity_results['activity_metrics'].get('avg_daily_steps', 'N/A')}")
    
    print("\n✅ Specialized analytics modules tested successfully")

class RecoveryPatternAnalytics:
    """Cross-domain recovery pattern analysis.

    This module complements the generic recovery scoring in the enhanced engine by
    performing a more granular multi-indicator pattern decomposition using only
    lightweight SQL (no SciPy / sklearn dependencies here to keep import surface small).

    Returned structure (all keys optional if data scarce):
      {
        'summary': {
            'days_analyzed': int,
            'baseline_rhr': float,          # mean of last baseline_window days
            'current_rhr': float,           # mean of last recent_window days
            'rhr_deviation_pct': float,     # (current-baseline)/baseline*100
            'avg_hrv': float,
            'hrv_trend': 'rising'|'falling'|'stable'|None,
            'avg_sleep_efficiency': float,
            'avg_sleep_score': float,
            'avg_stress': float,
            'avg_steps': float,
        },
        'indicator_breakdown': {
            'rhr_score': float,
            'hrv_score': float,
            'sleep_score_component': float,
            'stress_score': float,
            'activity_load_score': float,
        },
        'daily_classification': [ { 'day': 'YYYY-MM-DD', 'recovery_score': float, 'classification': str } ],
        'classification_distribution': { 'optimal': n, 'balanced': n, 'under_recovered': n, 'overreached': n },
        'factor_correlations': [ { 'factor': str, 'r': float, 'n': int } ],
        'recommendations': [ str, ... ]
      }
    """

    def analyze_recovery_patterns(self, days: int = 90, baseline_window: int = 30, recent_window: int = 7):
        """Enhanced recovery pattern analysis with improved HRV handling.

        Changes vs legacy implementation:
        - Incorporates manual HRV (daily_journal.hrv_ms) with forward-fill (optional HRV_FFILL_MAX_DAYS limit)
        - Fallback to proxy STDDEV(bpm) only when no manual/ffill value available
        - Winsorization of HRV distribution (5–95%) prior to deriving percentile-based cap
        - Adaptive baseline: rolling median (window 14, using only prior values)
        - Dynamic cap: max(75th percentile, adaptive*1.2, EMA*1.15 after >=30 samples)
        - Exponent scaling (0.7) to soften saturation of high HRV
        - 3-day rolling median smoothing of raw HRV used for trend & deviation logic
        - Summary exposes: hrv_raw, hrv_raw_smoothed, hrv_baseline, hrv_cap, hrv_component, hrv_source
        - Indicator breakdown adds HRV context fields
        """
        baseline_window = max(7, min(baseline_window, days))
        recent_window = max(3, min(recent_window, baseline_window))

        query = """
        SELECT 
            g.day,
            g.resting_heart_rate as rhr,
            g.stress_avg,
            g.steps,
            g.vigorous_activity_time,
            s.sleep_score,
            (s.sleep_duration_seconds/60.0) as sleep_duration_min,
            s.deep_sleep_seconds as deep_sec,
            s.light_sleep_seconds as light_sec,
            s.rem_sleep_seconds as rem_sec,
            s.awake_seconds as awake_sec,
            d.hrv_ms AS hrv_manual,
            proxy.hr_variability AS hrv_proxy
        FROM garmin_daily_summaries g
        LEFT JOIN garmin_sleep_sessions s ON g.day = s.day
        LEFT JOIN daily_journal d ON g.day = d.day
        LEFT JOIN (
            SELECT DATE(ts) as day, STDDEV(bpm) as hr_variability
            FROM garmin_heart_rate_data
            GROUP BY DATE(ts)
        ) proxy ON g.day = proxy.day
        WHERE g.day >= (SELECT COALESCE(MAX(day), CURRENT_DATE) FROM garmin_daily_summaries) - (%s * INTERVAL '1 day')
        ORDER BY g.day ASC
        """
        rows = execute_query(query, (days,)) or []
        if len(rows) < 5:
            return {'error': 'insufficient_data', 'days_available': len(rows)}

        # Helpers
        def _f(val):
            try:
                return float(val) if val is not None else None
            except Exception:
                return None
        def _mean(vals):
            v = [ _f(x) for x in vals if _f(x) is not None ]
            return (sum(v)/len(v)) if v else None
        def _pct(arr, p):
            if not arr:
                return None
            arr_sorted = sorted(arr)
            k = (len(arr_sorted)-1)*(p/100.0)
            f = int(k); c = min(f+1, len(arr_sorted)-1)
            if f == c:
                return arr_sorted[f]
            return arr_sorted[f] + (arr_sorted[c]-arr_sorted[f])*(k-f)
        def _winsor(arr, low=5, high=95):
            if not arr:
                return []
            pl = _pct(arr, low); ph = _pct(arr, high)
            if pl is None or ph is None or pl >= ph:
                return arr[:]
            return [min(max(v, pl), ph) for v in arr]

        # Forward-fill manual HRV logic (similar to enhanced engine)
        from datetime import datetime as _dt, date as _date
        ffill_limit_env = os.getenv('HRV_FFILL_MAX_DAYS')
        try:
            ffill_limit_days = int(ffill_limit_env) if ffill_limit_env else None
        except Exception:
            ffill_limit_days = None
        last_manual_hrv = None
        last_manual_day = None
        for r in rows:
            manual = r.get('hrv_manual')
            proxy = r.get('hrv_proxy')
            # Parse day to date object if possible
            day_obj = r.get('day')
            if day_obj is not None and not hasattr(day_obj, 'isoformat'):
                try:
                    day_obj = _dt.fromisoformat(str(day_obj)).date()
                except Exception:
                    day_obj = None
            if manual is not None:
                try:
                    val = float(manual)
                    r['hrv'] = val
                    r['hrv_source'] = 'manual_journal'
                    last_manual_hrv = val
                    last_manual_day = day_obj
                    continue
                except Exception:
                    pass
            # forward fill
            chosen = None; source = None
            if last_manual_hrv is not None and last_manual_day is not None:
                allow_ffill = True
                if ffill_limit_days is not None and isinstance(day_obj, _date) and isinstance(last_manual_day, _date):
                    if (day_obj - last_manual_day).days > ffill_limit_days:
                        allow_ffill = False
                if allow_ffill:
                    chosen = last_manual_hrv
                    source = 'manual_ffill'
            if chosen is None and proxy is not None:
                try:
                    chosen = float(proxy); source = 'garmin_stddev_proxy'
                except Exception:
                    pass
            r['hrv'] = chosen
            r['hrv_source'] = source

        # Sleep efficiency simple calc
        for r in rows:
            try:
                dur = _f(r.get('sleep_duration_min'))
                awake_sec = _f(r.get('awake_sec'))
                tib_min = dur if dur else None
                asleep_min = None
                if dur is not None and awake_sec is not None:
                    awake_min = awake_sec/60.0
                    asleep_min = max(0.0, dur - awake_min)
                if asleep_min is not None and tib_min and tib_min > 0:
                    r['sleep_efficiency'] = round(asleep_min / tib_min * 100, 1)
                else:
                    r['sleep_efficiency'] = None
            except Exception:
                r['sleep_efficiency'] = None

        # Derive HRV baselines & components
        hrv_sequence = [ _f(r.get('hrv')) for r in rows ]
        hrv_all_raw = [v for v in hrv_sequence if v is not None]
        hrv_all_w = _winsor(hrv_all_raw, 5, 95)
        hrv_cap_global = _pct(hrv_all_w, 75) if hrv_all_w else None
        # Rolling median (window 14, prior values only)
        window = 14
        def _rolling_median(seq, idx):
            start = max(0, idx-window)
            subset = [v for v in seq[start:idx] if v is not None]
            if len(subset) < 5:
                return None
            s = sorted(subset)
            m = len(s)//2
            return s[m] if len(s)%2==1 else (s[m-1]+s[m])/2.0
        rolling_baselines = []
        for i in range(len(hrv_sequence)):
            rolling_baselines.append(_rolling_median(hrv_sequence, i))
        # EMA series
        ema_alpha = 0.1
        hrv_ema = []
        for v in hrv_sequence:
            if v is None:
                hrv_ema.append(hrv_ema[-1] if hrv_ema else None)
            else:
                if not hrv_ema or hrv_ema[-1] is None:
                    hrv_ema.append(v)
                else:
                    hrv_ema.append(hrv_ema[-1] + ema_alpha*(v - hrv_ema[-1]))
        # 3-day rolling median smoothing of raw
        def _rolling_median_simple(values, win=3):
            out = []
            from statistics import median
            for i in range(len(values)):
                subset = [v for v in values[max(0,i-win+1):i+1] if v is not None]
                if subset:
                    try:
                        out.append(median(subset))
                    except Exception:
                        out.append(subset[-1])
                else:
                    out.append(None)
            return out
        hrv_smoothed = _rolling_median_simple(hrv_sequence, 3)

        def _hrv_component(val, idx):
            if val is None:
                return None, None, None
            adaptive = rolling_baselines[idx]
            cap = hrv_cap_global
            if adaptive and adaptive > 0:
                cap = max(cap or 0, adaptive*1.2)
            if len(hrv_all_raw) >= 30 and hrv_ema[idx]:
                cap = max(cap or 0, hrv_ema[idx]*1.15)
            if not cap or cap <= 0:
                return None, adaptive, cap
            ratio = val / cap
            score = (ratio ** 0.7) * 100.0
            score = max(0.0, min(100.0, score))
            return score, adaptive, cap

        # Annotate rows with HRV contextual fields
        for i, r in enumerate(rows):
            val = hrv_sequence[i]
            comp, base, cap = _hrv_component(val, i)
            r['hrv_component'] = comp
            r['hrv_baseline_adaptive'] = base
            r['hrv_cap_use'] = cap
            r['hrv_raw_smoothed'] = hrv_smoothed[i]

        # Baseline vs recent windows for summary (RHR oriented)
        baseline_slice = rows[-baseline_window:]
        recent_slice = rows[-recent_window:]
        baseline_rhr = _mean([r.get('rhr') for r in baseline_slice])
        current_rhr = _mean([r.get('rhr') for r in recent_slice])
        rhr_dev = None
        if baseline_rhr and current_rhr:
            try:
                rhr_dev = round((current_rhr - baseline_rhr)/baseline_rhr * 100, 2)
            except Exception:
                rhr_dev = None
        avg_hrv = _mean([r.get('hrv') for r in baseline_slice])
        # Trend (smoothed last3 vs prev3)
        hrv_vals_trend = [v for v in hrv_smoothed if v is not None]
        hrv_trend = None
        if len(hrv_vals_trend) >= 6:
            last3 = _mean(hrv_vals_trend[-3:])
            prev3 = _mean(hrv_vals_trend[-6:-3])
            if last3 and prev3:
                delta = last3 - prev3
                if abs(delta) < 0.5:
                    hrv_trend = 'stable'
                else:
                    hrv_trend = 'rising' if delta > 0 else 'falling'
        avg_sleep_eff = _mean([r.get('sleep_efficiency') for r in baseline_slice])
        avg_sleep_score = _mean([r.get('sleep_score') for r in baseline_slice])
        avg_stress = _mean([r.get('stress_avg') for r in baseline_slice])
        avg_steps = _mean([r.get('steps') for r in baseline_slice])

        latest_idx = len(rows)-1
        latest_row = rows[latest_idx]
        latest_hrv_raw = hrv_sequence[latest_idx]
        latest_hrv_comp = latest_row.get('hrv_component')
        latest_hrv_base = latest_row.get('hrv_baseline_adaptive')
        latest_hrv_cap = latest_row.get('hrv_cap_use')
        latest_hrv_smoothed = latest_row.get('hrv_raw_smoothed')
        latest_hrv_source = latest_row.get('hrv_source')

        summary = {
            'days_analyzed': len(rows),
            'baseline_rhr': round(baseline_rhr,1) if baseline_rhr else None,
            'current_rhr': round(current_rhr,1) if current_rhr else None,
            'rhr_deviation_pct': rhr_dev,
            'avg_hrv': round(avg_hrv,1) if avg_hrv else None,
            'hrv_trend': hrv_trend,
            'avg_sleep_efficiency': round(avg_sleep_eff,1) if avg_sleep_eff else None,
            'avg_sleep_score': round(avg_sleep_score,1) if avg_sleep_score else None,
            'avg_stress': round(avg_stress,1) if avg_stress else None,
            'avg_steps': round(avg_steps,0) if avg_steps else None,
            # HRV context
            'hrv_raw': latest_hrv_raw,
            'hrv_raw_smoothed': latest_hrv_smoothed,
            'hrv_baseline': latest_hrv_base,
            'hrv_cap': latest_hrv_cap,
            'hrv_component': round(latest_hrv_comp,1) if latest_hrv_comp is not None else None,
            'hrv_source': latest_hrv_source,
        }

        # Daily classification using component scores
        daily = []
        for r in rows:
            metrics = {}
            score_acc = 0.0
            count = 0
            rhr_v = _f(r.get('rhr'))
            if rhr_v is not None:
                score_acc += max(0.0, 100.0 - (rhr_v - 40.0) * 2.0); count += 1; metrics['rhr'] = rhr_v
            hrv_comp = r.get('hrv_component')
            if hrv_comp is not None:
                score_acc += hrv_comp; count += 1; metrics['hrv_component'] = hrv_comp
            ss_v = _f(r.get('sleep_score'))
            if ss_v is not None:
                score_acc += ss_v; count += 1; metrics['sleep_score'] = ss_v
            se_v = _f(r.get('sleep_efficiency'))
            if se_v is not None:
                score_acc += max(0.0, min(100.0, se_v)); count += 1; metrics['sleep_eff'] = se_v
            stress_v = _f(r.get('stress_avg'))
            if stress_v is not None:
                score_acc += max(0.0, 100.0 - stress_v); count += 1; metrics['stress'] = stress_v
            steps_v = _f(r.get('steps'))
            if steps_v is not None:
                if steps_v < 4000:
                    load_score = max(0.0, 50.0 - (4000-steps_v)/80.0)
                elif steps_v > 15000:
                    load_score = max(0.0, 80.0 - (steps_v-15000)/150.0)
                else:
                    load_score = 90.0
                score_acc += load_score; count += 1; metrics['steps'] = steps_v
            if count == 0:
                continue
            rec_score = round(score_acc / count, 1)
            cls = 'balanced'
            if rec_score >= 80:
                cls = 'optimal'
            elif rec_score < 55:
                if steps_v and steps_v > 14000 and (ss_v and ss_v < 65):
                    cls = 'overreached'
                else:
                    cls = 'under_recovered'
            daily.append({
                'day': r.get('day').isoformat() if hasattr(r.get('day'),'isoformat') else r.get('day'),
                'recovery_score': rec_score,
                'classification': cls
            })

        dist = { 'optimal':0,'balanced':0,'under_recovered':0,'overreached':0 }
        for d in daily:
            if d['classification'] in dist:
                dist[d['classification']] += 1

        # Correlations
        def _pearson(pairs):
            try:
                if len(pairs) < 5:
                    return None
                xs, ys = zip(*pairs)
                mx, my = _mean(xs), _mean(ys)
                num = sum((x-mx)*(y-my) for x,y in pairs)
                denx = sum((x-mx)**2 for x in xs)
                deny = sum((y-my)**2 for y in ys)
                denom = (denx*deny)**0.5
                if denom == 0:
                    return None
                return round(num/denom,3)
            except Exception:
                return None
        factors = ['sleep_score','steps','stress_avg','rhr','hrv_component']
        corr_list = []
        score_map = { d['day']: d['recovery_score'] for d in daily }
        for f in factors:
            pairs = []
            for r in rows:
                day_key = r.get('day').isoformat() if hasattr(r.get('day'),'isoformat') else r.get('day')
                if day_key in score_map:
                    val = _f(r.get(f)) if f!='hrv_component' else _f(r.get('hrv_component'))
                    if val is not None:
                        pairs.append((val, score_map[day_key]))
            r_val = _pearson(pairs)
            if r_val is not None:
                corr_list.append({'factor': f, 'r': r_val, 'n': len(pairs)})

        # Indicator breakdown
        indicator_breakdown = {}
        if rows:
            last_row = rows[-1]
            rhr_v = _f(last_row.get('rhr'))
            if rhr_v is not None:
                indicator_breakdown['rhr_score'] = round(max(0.0, 100.0 - (rhr_v - 40.0) * 2.0),1)
            if last_row.get('hrv_component') is not None:
                indicator_breakdown['hrv_score'] = round(last_row['hrv_component'],1)
                indicator_breakdown['hrv_raw'] = last_row.get('hrv')
                indicator_breakdown['hrv_baseline'] = last_row.get('hrv_baseline_adaptive')
                indicator_breakdown['hrv_cap'] = last_row.get('hrv_cap_use')
                indicator_breakdown['hrv_source'] = last_row.get('hrv_source')
            ss_v = _f(last_row.get('sleep_score'))
            if ss_v is not None:
                indicator_breakdown['sleep_score_component'] = round(ss_v,1)
            stress_v = _f(last_row.get('stress_avg'))
            if stress_v is not None:
                indicator_breakdown['stress_score'] = round(max(0.0, 100.0 - stress_v),1)
            steps_v = _f(last_row.get('steps'))
            if steps_v is not None:
                if steps_v < 4000:
                    load_score = max(0.0, 50.0 - (4000-steps_v)/80.0)
                elif steps_v > 15000:
                    load_score = max(0.0, 80.0 - (steps_v-15000)/150.0)
                else:
                    load_score = 90.0
                indicator_breakdown['activity_load_score'] = round(load_score,1)

        # Recommendations
        recs = []
        if rhr_dev and rhr_dev > 5:
            recs.append("Elevated RHR vs baseline – prioritize rest & hydration")
        if summary.get('avg_sleep_efficiency') and summary['avg_sleep_efficiency'] < 85:
            recs.append("Improve sleep efficiency: consistent schedule & pre-sleep routine")
        if hrv_trend == 'falling':
            recs.append("HRV trending down – incorporate active recovery / stress reduction")
        if summary.get('hrv_component') is not None and summary['hrv_component'] < 45:
            recs.append("Low HRV component – emphasize restorative sleep & parasympathetic activities")
        if summary.get('avg_stress') and summary['avg_stress'] > 55:
            recs.append("High average stress – schedule relaxation or mindfulness sessions")
        if summary.get('avg_steps') and summary['avg_steps'] > 15000:
            recs.append("High chronic activity load – add lower-intensity or rest days")
        if not recs:
            recs.append("Recovery patterns stable – maintain balanced habits")

        return {
            'summary': summary,
            'indicator_breakdown': indicator_breakdown,
            'daily_classification': daily,
            'classification_distribution': dist,
            'factor_correlations': corr_list,
            'recommendations': recs[:5]
        }


if __name__ == '__main__':
    main()