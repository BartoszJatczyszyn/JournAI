from datetime import datetime
import os
from statistics import mean, stdev, median
import math

from dotenv import load_dotenv
from db import execute_query

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

        # Fallback: if distance or active minutes are missing in daily summaries,
        # aggregate from garmin_activities for the date range returned.
        try:
            days_present = [r.get('day') for r in data if r.get('day')]
            if days_present:
                # normalize to ISO dates
                ds = [d.isoformat() if hasattr(d, 'isoformat') else str(d) for d in days_present]
                start_day = min(ds)
                end_day = max(ds)
                agg_q = """
                SELECT COALESCE(day, start_time::date) AS day,
                       SUM(COALESCE(distance, 0)) / 1000.0 AS distance_km,
                       SUM(COALESCE(moving_time, elapsed_time, 0)) AS total_seconds,
                       COUNT(*) AS sessions
                FROM garmin_activities
                WHERE COALESCE(day, start_time::date) BETWEEN %s AND %s
                GROUP BY COALESCE(day, start_time::date)
                """
                agg_rows = execute_query(agg_q, (start_day, end_day)) or []
                agg_map = { (r.get('day').isoformat() if hasattr(r.get('day'), 'isoformat') else str(r.get('day'))): r for r in agg_rows }
                # merge aggregated values into data rows when missing
                for r in data:
                    day_key = r.get('day').isoformat() if hasattr(r.get('day'), 'isoformat') else (str(r.get('day')) if r.get('day') else None)
                    if not day_key:
                        continue
                    agg = agg_map.get(day_key)
                    if not agg:
                        continue
                    # distance: prefer existing, else use aggregated km
                    if r.get('distance') is None and agg.get('distance_km') is not None:
                        try:
                            r['distance'] = float(agg.get('distance_km'))
                        except Exception:
                            pass
                    # active minutes: if moderate/vigorous missing, populate moderate_activity_time with total minutes
                    try:
                        total_min = None
                        if agg.get('total_seconds') is not None:
                            total_min = float(agg.get('total_seconds')) / 60.0
                        if (r.get('moderate_activity_time') is None and r.get('vigorous_activity_time') is None) and total_min is not None:
                            r['moderate_activity_time'] = total_min
                    except Exception:
                        pass
        except Exception:
            # Non-fatal: fall back to original data
            pass

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
            -- distance: prefer distance_meters (convert to km) or activities_distance (already km)
            COALESCE(g.distance_meters/1000.0, g.activities_distance) AS distance,
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
        -- Activities data (derive duration in minutes from moving_time or elapsed_time)
        a.sport,
        (CASE WHEN a.moving_time IS NOT NULL AND a.moving_time <> 0 THEN (a.moving_time::double precision / 60.0)
            WHEN a.elapsed_time IS NOT NULL AND a.elapsed_time <> 0 THEN (a.elapsed_time::double precision / 60.0)
            ELSE NULL END) AS duration,
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
                # isinstance() requires a type or tuple of types; use (int, float)
                sports_data[sport]['total_duration'] += d['duration'] if isinstance(d['duration'], (int, float)) else 0
                
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

    def analyze_running(self, days: int = 90, start_date: str | None = None, end_date: str | None = None):
        """Produce running-focused analytics using garmin_activities and related tables.

        Extended version adds:
          - Optional explicit date range (start_date, end_date) overriding days window (inclusive, ISO 'YYYY-MM-DD')
          - Ascending ordered timeseries for charting (older -> newer) so newest appears on right side of X axis
          - Extended correlation matrix including cadence, step length, vertical oscillation, ground contact, stress
          - Multiple duo scatter datasets (distance↔pace, distance↔hr, cadence↔pace, step_length↔pace, vert_osc↔pace, ground_contact↔pace)
          - Summary metrics (total distance, avg & median pace, avg HR, avg cadence, avg step length, load per week)
          - Available field list for frontend dynamic chart building

        
                            Basic validation; silently ignore if malformed (fallback to days).

                            
                             
                             * weekly: weekly aggregates
                             
                             * correlations_extended: extended matrix (inline dates into SQL to avoid param-binding/date-casting issues)
                             * summary: aggregate stats
                             * meta: {'mode':'range'|'rolling','range':{...}}
                             * available_fields: list of numeric fields present (non-null at least once)
        """
        # Build dynamic query depending on provided date range
        params = []
        if start_date and end_date:
            # Basic validation; silently ignore if malformed (fallback to days)
            try:
                from datetime import date as _date
                _date.fromisoformat(start_date)
                _date.fromisoformat(end_date)
                # Inline the date range into SQL (matches debug endpoint which returned rows)
                date_clause = f"COALESCE(day, start_time::date) BETWEEN '{start_date}' AND '{end_date}'"
                query = f"""
                SELECT
                    activity_id,
                    name,
                    sport,
                    start_time,
                    stop_time,
                    day,
                    distance,
                    elapsed_time,
                    moving_time,
                    calories,
                    training_load,
                    avg_hr,
                    max_hr,
                    avg_speed,
                    avg_pace,
                    max_pace,
                    avg_steps_per_min,
                    avg_step_length,
                    avg_vertical_oscillation,
                    avg_vertical_ratio,
                    avg_rr,
                    max_rr,
                    avg_ground_contact_time,
                    steps,
                    avg_steps_per_min,
                    max_steps_per_min,
                    vo2_max,
                    avg_stress,
                    max_stress
                FROM garmin_activities
                WHERE lower(sport) = 'running' AND {date_clause}
                ORDER BY start_time DESC
                """
                mode = 'range'
                params = None
            except Exception:
                # Fallback to rolling window if dates invalid
                query = """
                SELECT
                    activity_id,
                    name,
                    sport,
                    start_time,
                    stop_time,
                    day,
                    distance,
                    elapsed_time,
                    moving_time,
                    calories,
                    training_load,
                    avg_hr,
                    max_hr,
                    avg_speed,
                    avg_pace,
                    max_pace,
                    avg_steps_per_min,
                    avg_step_length,
                    avg_vertical_oscillation,
                    avg_vertical_ratio,
                    avg_rr,
                    max_rr,
                    avg_ground_contact_time,
                    steps,
                    avg_steps_per_min,
                    max_steps_per_min,
                    vo2_max,
                    avg_stress,
                    max_stress
                FROM garmin_activities
                WHERE lower(sport) = 'running' AND (COALESCE(day, start_time::date) >= (CURRENT_DATE - (%s * INTERVAL '1 day')))
                ORDER BY start_time DESC
                """
                params = [days]
                mode = 'rolling'
        else:
            query = """
            SELECT
                activity_id,
                name,
                sport,
                start_time,
                stop_time,
                day,
                distance,
                elapsed_time,
                moving_time,
                calories,
                training_load,
                avg_hr,
                max_hr,
                avg_speed,
                avg_pace,
                max_pace,
                avg_steps_per_min,
                avg_step_length,
                avg_vertical_oscillation,
                avg_vertical_ratio,
                avg_rr,
                max_rr,
                avg_ground_contact_time,
                steps,
                avg_steps_per_min,
                max_steps_per_min,
                vo2_max,
                avg_stress,
                max_stress
            FROM garmin_activities
            WHERE lower(sport) = 'running' AND (COALESCE(day, start_time::date) >= (CURRENT_DATE - (%s * INTERVAL '1 day')))
            ORDER BY start_time DESC
            """
            params = [days]
            mode = 'rolling'

        # Normalize parameters: if params is None, pass None to execute_query
        exec_params = None if not params else (tuple(params) if not isinstance(params, tuple) else params)
        rows = execute_query(query, exec_params) or []
        # --- Diagnostic: capture raw rows info to help debug why runs may be empty
        _debug_raw_rows = []
        try:
            for r in (rows or [])[:5]:
                entry = {}
                for k, v in r.items():
                    # serialize datetimes to iso strings for JSON-friendly debug output
                    try:
                        if hasattr(v, 'isoformat'):
                            entry[k] = v.isoformat()
                        else:
                            entry[k] = v
                    except Exception:
                        entry[k] = str(v)
                _debug_raw_rows.append(entry)
        except Exception:
            _debug_raw_rows = []
        runs = []
        _debug_row_errors = []
        _debug_skipped_rows = 0
        # Track how many times we had to fallback to start_time date because day was NULL
        _fallback_day_assigned = 0
        for r in rows:
            try:
                dist_m = r.get('distance')
                dist_km = None
                if dist_m is not None:
                    try:
                        dist_km = float(dist_m) / 1000.0
                        # Filter out obviously bad distances (negative or unrealistically huge > 1000km)
                        if dist_km < 0 or dist_km > 1000:
                            dist_km = None
                    except Exception:
                        dist_km = None
                dur_s = r.get('moving_time') if r.get('moving_time') not in (None, 0) else r.get('elapsed_time')
                dur_min = None
                if dur_s is not None and dur_s != 0:
                    try:
                        dur_min = float(dur_s) / 60.0
                        if dur_min < 0:
                            dur_min = None
                    except Exception:
                        dur_min = None
                # avg_pace may already be stored as min/km; compute a canonical avg_pace value
                avg_pace_val = None
                def _pace_to_min_per_km(val):
                    try:
                        if val is None:
                            return None
                        import datetime as _dt
                        # datetime.time from DB
                        if isinstance(val, _dt.time):
                            secs = val.hour*3600 + val.minute*60 + val.second
                            return secs / 60.0
                        # ISO8601 duration like PT4M35S or PT34M or PT1H05M30S
                        if isinstance(val, str) and val.startswith('PT'):
                            # Strip PT then parse tokens ending with H, M, S
                            iso = val[2:]
                            h = m = s = 0.0
                            cur = ''
                            for ch in iso:
                                if ch.isdigit() or ch == '.':
                                    cur += ch
                                else:
                                    try:
                                        num = float(cur) if cur else 0.0
                                    except Exception:
                                        num = 0.0
                                    if ch == 'H':
                                        h = num
                                    elif ch == 'M':
                                        m = num
                                    elif ch == 'S':
                                        s = num
                                    cur = ''
                            secs = h*3600 + m*60 + s
                            if secs > 0:
                                return secs / 60.0
                        # string like HH:MM:SS or MM:SS
                        if isinstance(val, str):
                            parts = val.split(':')
                            parts = [p for p in parts if p!='']
                            if len(parts) == 3:
                                h = int(parts[0]); m = int(parts[1]); s = float(parts[2])
                                secs = h*3600 + m*60 + s
                                return secs / 60.0
                            if len(parts) == 2:
                                m = int(parts[0]); s = float(parts[1])
                                secs = m*60 + s
                                return secs / 60.0
                            # fallback numeric string -> assume already minutes
                            return float(val)
                        # numeric: assume minutes (float)
                        return float(val)
                    except Exception:
                        return None

                raw_avg_pace = r.get('avg_pace')
                if raw_avg_pace is not None:
                    avg_pace_val = _pace_to_min_per_km(raw_avg_pace)
                elif r.get('avg_speed') is not None:
                    try:
                        spd = float(r.get('avg_speed'))
                        # Detect unit heuristically: if spd < 25 assume km/h, if < 8 maybe m/s (convert)
                        if spd <= 12:  # could be km/h typical easy runs 8-12
                            avg_pace_val = 60.0 / spd if spd > 0 else None
                        elif spd < 25:  # still plausible km/h fast
                            avg_pace_val = 60.0 / spd if spd > 0 else None
                        else:  # treat as m/s (unlikely but safeguard)
                            avg_pace_val = (1000.0 / spd) / 60.0 if spd > 0 else None
                    except Exception:
                        avg_pace_val = None
                elif dist_km is not None and dur_min:
                    try:
                        avg_pace_val = dur_min / dist_km if dist_km > 0 else None
                    except Exception:
                        avg_pace_val = None

                # Fallback day if NULL using start_time
                start_dt = r.get('start_time')
                day_val = r.get('day')
                if day_val is not None:
                    try:
                        day_iso = day_val.isoformat()
                    except Exception:
                        day_iso = str(day_val)
                else:
                    if start_dt:
                        try:
                            day_iso = start_dt.date().isoformat()
                            _fallback_day_assigned += 1
                        except Exception:
                            day_iso = None
                    else:
                        day_iso = None

                # Cast numerics safely (Decimal -> float)
                def _cast_num(v):
                    try:
                        if v is None:
                            return None
                        return float(v)
                    except Exception:
                        return None

                runs.append({
                    'activity_id': r.get('activity_id'),
                    'name': r.get('name'),
                    'start_time': start_dt.isoformat() if start_dt else None,
                    'day': day_iso,
                    'distance_km': round(dist_km, 3) if dist_km is not None else None,
                    'duration_min': round(dur_min, 1) if dur_min is not None else None,
                    'avg_pace': round(avg_pace_val, 3) if avg_pace_val is not None else None,
                    'avg_hr': _cast_num(r.get('avg_hr')),
                    'max_hr': _cast_num(r.get('max_hr')),
                    'avg_rr': _cast_num(r.get('avg_rr')),
                    'max_rr': _cast_num(r.get('max_rr')),
                    'calories': _cast_num(r.get('calories')),
                    'training_load': _cast_num(r.get('training_load')),
                    'avg_step_length_m': _cast_num(r.get('avg_step_length')),
                    # No dedicated avg_cadence column in DB; use avg_steps_per_min as cadence proxy
                    # (frontend previously consumed avg_cadence)
                    'avg_steps_per_min': _cast_num(r.get('avg_steps_per_min')),
                    'avg_vertical_oscillation': _cast_num(r.get('avg_vertical_oscillation')),
                    'avg_vertical_ratio': _cast_num(r.get('avg_vertical_ratio')),
                    'avg_ground_contact_time': _cast_num(r.get('avg_ground_contact_time')),
                    'vo2_max': _cast_num(r.get('vo2_max')),
                    'steps': _cast_num(r.get('steps')),
                    'max_steps_per_min': _cast_num(r.get('max_steps_per_min')),
                    'avg_stress': _cast_num(r.get('avg_stress')),
                    'max_stress': _cast_num(r.get('max_stress')),
                })
            except Exception as _row_ex:
                try:
                    _debug_row_errors.append({'activity_id': r.get('activity_id'), 'error': str(_row_ex)})
                except Exception:
                    _debug_row_errors.append({'activity_id': None, 'error': 'row_error_unserializable'})
                _debug_skipped_rows += 1
                continue

        # Weekly aggregation
        weekly = {}
        import datetime as _dt
        def iso_week_key(day_str):
            try:
                d = _dt.date.fromisoformat(day_str)
                y, w, _ = d.isocalendar()
                return f"{y}-W{str(w).zfill(2)}"
            except Exception:
                return None

        for rr in runs:
            wk = iso_week_key(rr.get('day'))
            if not wk:
                continue
            w = weekly.setdefault(wk, {'week': wk, 'total_distance_km': 0.0, 'pace_vals': [], 'active_days': set()})
            if rr.get('distance_km'):
                w['total_distance_km'] += rr['distance_km']
            if rr.get('avg_pace') is not None:
                w['pace_vals'].append(rr['avg_pace'])
            if rr.get('day'):
                w['active_days'].add(rr['day'])

        weekly_out = []
        for k, v in sorted(weekly.items(), reverse=True):
            avg_pace = (sum(v['pace_vals']) / len(v['pace_vals'])) if v['pace_vals'] else None
            weekly_out.append({'week': v['week'], 'total_distance_km': round(v['total_distance_km'], 2), 'avg_pace': round(avg_pace,3) if avg_pace else None, 'active_days': len(v['active_days'])})

        # Correlations (pearson) between distance_km, duration_min, avg_pace, avg_hr, vo2_max (extended with training_load)
        import math

        def pearson(pairs):
            try:
                n = len(pairs)
                if n < 3:
                    return None
                xs, ys = zip(*pairs)
                mx = sum(xs)/n; my = sum(ys)/n
                num = sum((x-mx)*(y-my) for x,y in pairs)
                denx = sum((x-mx)**2 for x in xs)
                deny = sum((y-my)**2 for y in ys)
                denom = math.sqrt(denx*deny)
                if denom == 0:
                    return None
                return round(num/denom, 3)
            except Exception:
                return None

        fields = ['distance_km','duration_min','avg_pace','avg_hr','avg_rr','max_rr','vo2_max','avg_steps_per_min','training_load']
        corr_matrix = {f: {g: None for g in fields} for f in fields}
        for i, a in enumerate(fields):
            for j, b in enumerate(fields):
                if j <= i:
                    continue
                pairs = [(r.get(a), r.get(b)) for r in runs if r.get(a) is not None and r.get(b) is not None]
                v = pearson(pairs) if pairs else None
                corr_matrix[a][b] = v
                corr_matrix[b][a] = v

        scatter = [{'x': r.get('distance_km'), 'y': r.get('avg_pace'), 'label': r.get('start_time')} for r in runs if r.get('distance_km') is not None and r.get('avg_pace') is not None]

        # Extended correlations
        extended_fields = ['distance_km','duration_min','avg_pace','avg_hr','avg_rr','max_rr','vo2_max','avg_steps_per_min','training_load','avg_step_length_m','avg_vertical_oscillation','avg_vertical_ratio','avg_ground_contact_time','avg_stress']
        corr_ext = {f: {g: None for g in extended_fields} for f in extended_fields}
        for i, a in enumerate(extended_fields):
            for j, b in enumerate(extended_fields):
                if j <= i:
                    continue
                pairs = [(r.get(a), r.get(b)) for r in runs if r.get(a) is not None and r.get(b) is not None]
                v = pearson(pairs) if pairs else None
                corr_ext[a][b] = v
                corr_ext[b][a] = v

        # Full correlations (raw + derived) for heatmap the user requested
        # Prepare additional derived numeric fields inside per-run dicts (non-mutating base list except adding ephemeral keys)
        for rr in runs:
            try:
                if rr.get('duration_min') and rr.get('distance_km') and rr.get('distance_km') > 0:
                    rr['speed_kmh'] = (rr['distance_km'] / (rr['duration_min'] / 60.0))
                else:
                    rr['speed_kmh'] = None
                # cadence based step length alt (already have avg_step_length_m)
                # note: avg_pace is canonical
                # Energy proxy: calories per km
                if rr.get('distance_km') and rr.get('calories'):
                    try:
                        rr['calories_per_km'] = rr['calories'] / rr['distance_km'] if rr['distance_km'] > 0 else None
                    except Exception:
                        rr['calories_per_km'] = None
                else:
                    rr['calories_per_km'] = None
            except Exception:
                rr['speed_kmh'] = rr.get('speed_kmh') or None
        full_fields = [
            # Core distance/time
            'distance_km','duration_min','avg_pace',
            # Heart & stress
            'avg_hr','max_hr','avg_stress','max_stress',
            'avg_rr','max_rr',
            # Speed & energy
            'speed_kmh','calories','calories_per_km',
            # Cadence / steps
            'avg_steps_per_min','steps','max_steps_per_min',
            # Load
            'training_load',
            # Form / mechanics
            'avg_step_length_m','avg_vertical_oscillation','avg_vertical_ratio','avg_ground_contact_time',
            # Performance / physiology
            'vo2_max'
        ]
        correlations_full = {f: {g: None for g in full_fields} for f in full_fields}
        for i, a in enumerate(full_fields):
            for j, b in enumerate(full_fields):
                if j <= i:
                    continue
                pairs = [(r.get(a), r.get(b)) for r in runs if r.get(a) is not None and r.get(b) is not None]
                v = pearson(pairs) if pairs else None
                correlations_full[a][b] = v
                correlations_full[b][a] = v

        # Running Economy Insights
        economy = {}
        try:
            target_metric = 'avg_pace'  # lower is better
            focus_candidates = [
                'avg_hr','avg_step_length_m','avg_vertical_oscillation',
                    'avg_vertical_ratio','avg_rr','max_rr','avg_ground_contact_time','avg_steps_per_min','training_load','vo2_max','avg_stress','calories_per_km'
            ]
            focus_list = []
            for f in focus_candidates:
                if f == target_metric:
                    continue
                pairs = [(r.get(f), r.get(target_metric)) for r in runs if r.get(f) is not None and r.get(target_metric) is not None]
                r_val = pearson(pairs) if len(pairs) >= 3 else None
                if r_val is not None:
                    # Interpret direction: negative r with pace => desirable (associate with faster pace)
                    direction = 'improves_with_increase'
                    if f in ('avg_hr','avg_vertical_oscillation','avg_ground_contact_time','avg_stress','calories_per_km'):
                        # For these, lower values generally better
                        direction = 'improves_with_decrease' if r_val > 0 else 'worsens_if_decreased'
                    else:
                        direction = 'improves_with_increase' if r_val < 0 else 'unclear_or_inverse'
                    focus_list.append({'metric': f, 'r_vs_pace': r_val, 'direction': direction})
            # Sort by absolute correlation strength
            focus_list.sort(key=lambda x: abs(x['r_vs_pace'] or 0), reverse=True)
            # Generate top textual recommendations
            recs = []
            alias = {
                'avg_hr':'average HR','avg_step_length_m':'step length (m)',
                'avg_vertical_ratio':'vertical ratio (%)','avg_vertical_oscillation':'vertical oscillation (cm)','avg_ground_contact_time':'ground contact time (ms)',
                'avg_steps_per_min':'steps/min','vo2_max':'VO2max','avg_stress':'stress','calories_per_km':'calories/km'
            }
            for item in focus_list[:6]:
                m = item['metric']; r_val = item['r_vs_pace']
                label = alias.get(m, m)
                if item['direction'] == 'improves_with_decrease':
                    recs.append(f"Lower {label} – correlation with pace {r_val}; reducing it may help increase speed.")
                elif item['direction'] == 'improves_with_increase':
                    recs.append(f"Increase {label} – negative correlation with pace ({r_val}); increasing it may improve speed.")
                elif item['direction'] == 'worsens_if_decreased':
                    recs.append(f"Keep {label} stable – lowering it may worsen pace (r={r_val}).")
                else:
                    recs.append(f"{label}: correlation {r_val}; monitor further trends.")
            # Economy composite trend (optional)
            economy = {
                'focus_rankings': focus_list,
                'recommendations': recs,
                'target_metric': target_metric,
            }
        except Exception as _econ_ex:  # pragma: no cover
            economy = {'error': 'economy_computation_failed', 'details': str(_econ_ex)}

        # Duo scatter datasets
        def _scatter(x_field, y_field):
            return [
                {'x': r.get(x_field), 'y': r.get(y_field), 'label': r.get('start_time')}
                for r in runs if r.get(x_field) is not None and r.get(y_field) is not None
            ]
        duo_scatter = {
            'distance_vs_pace': _scatter('distance_km','avg_pace'),
            'distance_vs_hr': _scatter('distance_km','avg_hr'),
            'cadence_vs_pace': _scatter('avg_steps_per_min','avg_pace'),
            'step_length_vs_pace': _scatter('avg_step_length_m','avg_pace'),
            'vertical_osc_vs_pace': _scatter('avg_vertical_oscillation','avg_pace'),
            'ground_contact_vs_pace': _scatter('avg_ground_contact_time','avg_pace'),
        }

        # Ascending timeseries for charts (older first)
        runs_desc = list(runs)  # current order is DESC
        runs_asc = sorted(runs, key=lambda x: x.get('start_time') or '')
        timeseries = [
            {
                'start_time': r['start_time'],
                'day': r['day'],
                'distance_km': r['distance_km'],
                'avg_pace': r['avg_pace'],
                'avg_hr': r['avg_hr'],
                'avg_rr': r.get('avg_rr'),
                'max_rr': r.get('max_rr'),
                'avg_steps_per_min': r.get('avg_steps_per_min'),
                'avg_step_length_m': r.get('avg_step_length_m'),
                'avg_vertical_oscillation': r.get('avg_vertical_oscillation'),
                'avg_vertical_ratio': r.get('avg_vertical_ratio'),
                'avg_ground_contact_time': r.get('avg_ground_contact_time'),
                'vo2_max': r.get('vo2_max'),
                'avg_stress': r.get('avg_stress'),
            }
            for r in runs_asc
        ]

        # Summary
        distances = [r['distance_km'] for r in runs if r.get('distance_km') is not None]
        paces = [r['avg_pace'] for r in runs if r.get('avg_pace') is not None]
        hrs = [r['avg_hr'] for r in runs if r.get('avg_hr') is not None]
        cadences = [r['avg_steps_per_min'] for r in runs if r.get('avg_steps_per_min') is not None]
        step_lengths = [r['avg_step_length_m'] for r in runs if r.get('avg_step_length_m') is not None]
        loads = [r['training_load'] for r in runs if r.get('training_load') is not None]
        summary = {
            'runs_count': len(runs),
            'total_distance_km': round(sum(distances), 2) if distances else 0.0,
            'avg_distance_km': round(sum(distances)/len(distances), 2) if distances else None,
            'avg_pace': round(sum(paces)/len(paces), 3) if paces else None,
            'median_pace': round(median(paces), 3) if paces else None,
            'avg_hr': round(sum(hrs)/len(hrs),1) if hrs else None,
            'avg_cadence': round(sum(cadences)/len(cadences),1) if cadences else None,  # kept key for backwards compatibility
            'avg_step_length_m': round(sum(step_lengths)/len(step_lengths),3) if step_lengths else None,
            'total_training_load': round(sum(loads),2) if loads else None,
            'avg_training_load': round(sum(loads)/len(loads),2) if loads else None,
            'date_start': runs_asc[0]['day'] if runs_asc else None,
            'date_end': runs_asc[-1]['day'] if runs_asc else None,
        }
        # Weekly load per week (km)
        if weekly_out:
            summary['avg_weekly_distance_km'] = round(sum(w['total_distance_km'] for w in weekly_out)/len(weekly_out),2)

        # Pace form (z-score) & recent vs baseline comparison
        pace_form = {}
        if paces and len(paces) >= 3:
            try:
                p_mean = mean(paces)
                p_std = stdev(paces) if len(paces) > 1 else None
                # assign z-score to each run (lower pace => better form, so performance_score = -z)
                for r in runs_asc:
                    ap = r.get('avg_pace')
                    if ap is not None and p_std and p_std > 0:
                        r['pace_z'] = (ap - p_mean) / p_std
                        r['performance_score'] = -r['pace_z']
                    else:
                        r['pace_z'] = None
                        r['performance_score'] = None
                # Rolling windows (7d, 30d) based on date
                from datetime import date as _date
                def _within_days(ref_date_str, candidate_date_str, delta_days):
                    try:
                        rd = _date.fromisoformat(ref_date_str)
                        cd = _date.fromisoformat(candidate_date_str)
                        return 0 <= (rd - cd).days <= delta_days
                    except Exception:
                        return False
                if runs_asc:
                    latest_day = runs_asc[-1]['day']
                    last7 = [r.get('avg_pace') for r in runs_asc if r.get('day') and _within_days(latest_day, r.get('day'), 7) and r.get('avg_pace') is not None]
                    last30 = [r.get('avg_pace') for r in runs_asc if r.get('day') and _within_days(latest_day, r.get('day'), 30) and r.get('avg_pace') is not None]
                    if last30:
                        base_mean = mean(last30)
                    else:
                        base_mean = p_mean
                    recent_mean = mean(last7) if last7 else None
                    delta_pct = None
                    if recent_mean and base_mean:
                        try:
                            delta_pct = round((base_mean - recent_mean) / base_mean * 100, 2)  # positive => improvement
                        except Exception:
                            delta_pct = None
                    current_z = runs_asc[-1].get('pace_z')
                    pace_form = {
                        'pace_mean_all': round(p_mean, 3),
                        'pace_std_all': round(p_std, 3) if p_std else None,
                        'recent_mean_pace_7d': round(recent_mean, 3) if recent_mean else None,
                        'baseline_mean_pace_30d': round(base_mean, 3) if base_mean else None,
                        'recent_vs_baseline_delta_pct': delta_pct,
                        'current_pace_z': round(current_z, 3) if current_z is not None else None,
                        'current_form_score': round(-current_z, 3) if current_z is not None else None,
                    }
            except Exception:
                pace_form = {'error': 'pace_form_computation_failed'}
        else:
            pace_form = {'samples': len(paces)}

        # Training load & monotony (Acute vs Chronic) + interpretation & timeseries
        training_load = {}
        if runs_asc:
            from datetime import date as _date
            from datetime import timedelta as _td
            # Aggregate distance per day
            day_distance: dict[str, float] = {}
            for r in runs_asc:
                d = r.get('day')
                if d and r.get('distance_km') is not None:
                    day_distance.setdefault(d, 0.0)
                    day_distance[d] += r['distance_km']
            if day_distance:
                # Build ordered list of days (ascending)
                ordered_days = sorted(day_distance.keys())
                if ordered_days:
                    first = _date.fromisoformat(ordered_days[0])
                    last = _date.fromisoformat(ordered_days[-1])
                    # Ensure continuity (fill gaps with 0 distance for monotony / rolling windows)
                    cursor = first
                    while cursor < last:
                        iso = cursor.isoformat()
                        day_distance.setdefault(iso, day_distance.get(iso, 0.0))
                        cursor += _td(days=1)
                    ordered_days = sorted(day_distance.keys())

                def _rolling_sum(end_date_iso: str, window: int) -> float:
                    try:
                        end_d = _date.fromisoformat(end_date_iso)
                    except Exception:
                        return 0.0
                    total = 0.0
                    for i in range(window):
                        dt = (end_d - _td(days=i)).isoformat()
                        total += day_distance.get(dt, 0.0)
                    return total

                def _monotony(end_date_iso: str) -> tuple[float|None, float|None]:
                    try:
                        end_d = _date.fromisoformat(end_date_iso)
                    except Exception:
                        return None, None
                    vals = []
                    for i in range(7):
                        dt = (end_d - _td(days=i)).isoformat()
                        vals.append(day_distance.get(dt, 0.0))
                    if not any(v > 0 for v in vals):
                        return None, None
                    try:
                        m_mean = mean(vals)
                        m_std = stdev(vals) if len(set(vals)) > 1 else 0.0
                        monotony = round(m_mean / m_std, 3) if m_std > 0 else None
                        strain = round(_rolling_sum(end_date_iso,7) * (monotony or 0), 2) if monotony else None
                        return monotony, strain
                    except Exception:
                        return None, None

                # Build timeseries
                tl_timeseries = []
                for d_iso in ordered_days:
                    acute = _rolling_sum(d_iso, 7)
                    chronic = _rolling_sum(d_iso, 28)
                    acr = round(acute / chronic, 3) if chronic > 0 else None
                    mono, strain = _monotony(d_iso)
                    tl_timeseries.append({
                        'day': d_iso,
                        'distance_km': round(day_distance.get(d_iso, 0.0), 3),
                        'acute_7d': round(acute, 2),
                        'chronic_28d': round(chronic, 2),
                        'acute_chronic_ratio': acr,
                        'monotony_index': mono,
                        'training_strain': strain,
                    })

                # Current metrics (latest day)
                latest_day = ordered_days[-1]
                acute_7 = tl_timeseries[-1]['acute_7d']
                chronic_28 = tl_timeseries[-1]['chronic_28d']
                acr = tl_timeseries[-1]['acute_chronic_ratio']
                monotony = tl_timeseries[-1]['monotony_index']
                strain = tl_timeseries[-1]['training_strain']

                # Interpretation helpers
                def _acr_zone(val: float|None):
                    if val is None: return 'insufficient_data'
                    if val < 0.8: return 'detraining'
                    if val <= 1.3: return 'optimal'
                    if val <= 1.5: return 'rising_load'
                    return 'high_risk'
                def _monotony_zone(val: float|None):
                    if val is None: return 'unknown'
                    if val <= 1.0: return 'varied'
                    if val <= 1.5: return 'balanced'
                    if val <= 2.0: return 'moderate_monotony'
                    if val <= 2.5: return 'high_monotony'
                    return 'very_high_monotony'

                acr_zone = _acr_zone(acr)
                monotony_zone = _monotony_zone(monotony)
                risk_flags = []
                if acr_zone == 'high_risk': risk_flags.append('acr_high_risk')
                if monotony_zone in ('high_monotony','very_high_monotony'): risk_flags.append('monotony_high')
                if strain and strain > 600:  # heuristic threshold
                    risk_flags.append('strain_elevated')

                recommendations = []
                if 'acr_high_risk' in risk_flags:
                    recommendations.append('Plan a lighter day/recovery – high ACR (>1.5).')
                if acr_zone == 'detraining':
                    recommendations.append('Gradually increase volume to avoid detraining (ACR < 0.8).')
                if 'monotony_high' in risk_flags:
                    recommendations.append('Vary the loads – high monotony increases overuse risk.')
                if 'strain_elevated' in risk_flags:
                    recommendations.append('High strain – monitor fatigue and sleep quality.')
                if not recommendations and acr_zone == 'optimal' and monotony_zone in ('balanced','varied'):
                    recommendations.append('Load is in the optimal zone – continue the current plan.')

                training_load = {
                    'acute_distance_7d': round(acute_7, 2),
                    'chronic_distance_28d': round(chronic_28, 2),
                    'acute_chronic_ratio': acr,
                    'monotony_index': monotony,
                    'training_strain': strain,
                    'samples_days': len(ordered_days),
                    'interpretation': {
                        'acr_zone': acr_zone,
                        'monotony_zone': monotony_zone,
                        'risk_flags': risk_flags,
                        'recommendations': recommendations,
                    },
                    'timeseries': tl_timeseries,
                }
        if not training_load:
            training_load = {'samples': len(runs_asc)}

        # VO2max trend extrapolation
        vo2max_trend = {}
        vo2_values = [ (r.get('day'), r.get('vo2_max')) for r in runs_asc if r.get('vo2_max') is not None ]
        if len(vo2_values) >= 3:
            try:
                from datetime import date as _date
                # Use ordinal day as x
                xs = []
                ys = []
                for d, v in vo2_values:
                    try:
                        xs.append(_date.fromisoformat(d).toordinal())
                        ys.append(float(v))
                    except Exception:
                        continue
                n = len(xs)
                if n >= 3:
                    sx = sum(xs); sy = sum(ys)
                    sxx = sum(x*x for x in xs); sxy = sum(x*y for x,y in zip(xs,ys)); syy = sum(y*y for y in ys)
                    denom = (n * sxx - sx * sx)
                    slope = (n * sxy - sx * sy) / denom if denom != 0 else 0.0
                    intercept = (sy - slope * sx) / n if n else None
                    # correlation r
                    denr = ((n * sxx - sx*sx) * (n * syy - sy*sy)) ** 0.5
                    r = (n * sxy - sx * sy) / denr if denr else None
                    current = ys[-1]
                    change_30 = slope * 30
                    proj_30 = current + change_30
                    proj_60 = current + slope * 60
                    vo2max_trend = {
                        'samples': n,
                        'current': round(current, 2),
                        'mean': round(sum(ys)/n, 2),
                        'slope_per_day': round(slope, 4),
                        'change_per_30d': round(change_30, 2),
                        'projection_30d': round(proj_30, 2),
                        'projection_60d': round(proj_60, 2),
                        'r': round(r, 3) if r is not None else None,
                    }
            except Exception:
                vo2max_trend = {'error': 'vo2_trend_failed'}
        else:
            vo2max_trend = {'samples': len(vo2_values)}

        # Available fields (present at least once)
        numeric_fields = ['distance_km','duration_min','avg_pace','avg_hr','max_hr','avg_rr','max_rr','calories','training_load','avg_step_length_m','avg_vertical_oscillation','avg_vertical_ratio','avg_ground_contact_time','vo2_max','steps','avg_steps_per_min','max_steps_per_min','avg_stress','max_stress']
        available_fields = sorted({f for f in numeric_fields if any(r.get(f) is not None for r in runs)})

        meta = {'mode': mode}
        if mode == 'range':
            meta['range'] = {'start_date': start_date, 'end_date': end_date}
        else:
            meta['rolling_days'] = days

        # Attach debug diagnostics for troubleshooting data retrieval issues
        debug_info = {
            'raw_row_count': len(rows) if rows is not None else 0,
            'raw_row_sample': _debug_raw_rows,
            'query_mode': mode,
            'query_params': params,
            'skipped_rows': _debug_skipped_rows,
            'row_errors': _debug_row_errors,
        }
        # Include the raw SQL query for diagnostics (helps detect placeholder/format issues)
        try:
            debug_info['query'] = query
        except Exception:
            debug_info['query'] = None

        debug_info['fallback_day_assigned'] = _fallback_day_assigned
        return {
            'status': 'success',
            'period_days': days,
            'runs': runs_asc,  # ascending for charts
            'runs_desc': runs_desc,
            'weekly': weekly_out,
            'correlations': corr_matrix,
            'correlations_extended': corr_ext,
            'correlations_full': correlations_full,
            'scatter': scatter,
            'duo_scatter': duo_scatter,
            'timeseries': timeseries,
            'summary': summary,
            'running_economy': economy,
            'pace_form': pace_form,
            'training_load': training_load,
            'vo2max_trend': vo2max_trend,
            'available_fields': available_fields,
            'data_points': len(runs),
            'meta': meta,
            'debug': debug_info,
        }

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

        
    - Incorporates manual HRV (daily_journal.hrv_manual) with forward-fill (optional HRV_FFILL_MAX_DAYS limit)
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
            d.hrv_manual AS hrv_manual,
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