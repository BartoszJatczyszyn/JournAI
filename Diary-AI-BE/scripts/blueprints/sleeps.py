#!/usr/bin/env python3
"""Sleeps blueprint: listing and detail of sleep sessions with events and vitals.

Single Responsibility:
- HTTP endpoints for sleeps-related operations.

Liskov / Interface Segregation:
- Returns JSON structures used by the frontend without leaking DB-level details.

Dependency Inversion:
- Uses execute_query helper for DB interactions.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request, current_app
from db import execute_query

sleeps_bp = Blueprint("sleeps", __name__)


@sleeps_bp.get("/sleeps/latest")
def get_latest_sleeps():
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        conditions = ["sleep_start IS NOT NULL"]
        params = []
        if start_date:
            conditions.append("sleep_start >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("sleep_start <= %s")
            params.append(end_date)
        where_clause = " AND ".join(conditions)

        count_query = f"""
        SELECT COUNT(*) as total_count
        FROM garmin_sleep_sessions
        WHERE {where_clause}
        """
        total_row = execute_query(count_query, tuple(params), fetch_one=True)
        total_count = (total_row or {}).get('total_count', 0)

        safe_limit = int(limit)
        safe_offset = int(offset)

        # Detect optional columns to avoid UndefinedColumn
        try:
            cols_check = execute_query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_sleep_sessions' AND column_name IN ('avg_sleep_hr','avg_sleep_rr','avg_respiration','respiratory_rate','respRate','avg_sleep_stress','last_sleep_phase')",
                None,
                fetch_all=True,
            )
        except Exception:
            cols_check = None
        present = set([c.get('column_name') for c in (cols_check or []) if isinstance(c, dict)])

        select_cols = [
            'sleep_id','day','sleep_start','sleep_end','sleep_duration_seconds',
            'deep_sleep_seconds','light_sleep_seconds','rem_sleep_seconds','awake_seconds','sleep_score'
        ]
        if 'avg_sleep_hr' in present:
            select_cols.insert(4, 'avg_sleep_hr')
        rr_alternatives = ['avg_sleep_rr','avg_respiration','respiratory_rate','respRate']
        rr_col_to_select = next((alt for alt in rr_alternatives if alt in present), None)
        if rr_col_to_select:
            if rr_col_to_select == 'avg_sleep_rr':
                select_cols.insert(5, 'avg_sleep_rr')
            else:
                select_cols.insert(5, f"{rr_col_to_select} AS avg_sleep_rr")
        if 'avg_sleep_stress' in present:
            select_cols.insert(6, 'avg_sleep_stress')
        if 'last_sleep_phase' in present:
            select_cols.append('last_sleep_phase')

        query = f"""
        SELECT {', '.join(select_cols)}
        FROM garmin_sleep_sessions
        WHERE {where_clause}
        ORDER BY sleep_start DESC
        LIMIT {safe_limit} OFFSET {safe_offset}
        """
        rows = execute_query(query, tuple(params))
        if rows is None:
            current_app.logger.warning('execute_query returned None for latest sleeps query')
            rows = []

        res = []
        for r in rows or []:
            item = dict(r)
            # Derived efficiency
            try:
                dur_sec = r.get('sleep_duration_seconds')
                awake_sec = r.get('awake_seconds')
                start_raw = r.get('sleep_start')
                end_raw = r.get('sleep_end')
                denom = None
                if start_raw and end_raw:
                    try:
                        denom = (end_raw - start_raw).total_seconds()
                        if denom <= 0:
                            denom += 24*60*60
                    except Exception:
                        denom = None
                if denom is None and dur_sec is not None and awake_sec is not None and (float(dur_sec) + float(awake_sec)) > 0:
                    denom = float(dur_sec) + float(awake_sec)
                stages_sum = None
                try:
                    stages_sum = float((r.get('deep_sleep_seconds') or 0) + (r.get('light_sleep_seconds') or 0) + (r.get('rem_sleep_seconds') or 0))
                except Exception:
                    stages_sum = None
                num = float(dur_sec) if dur_sec is not None else None
                eff_val = None
                if denom and denom > 0:
                    if stages_sum and stages_sum > 0:
                        eff_val = (stages_sum / denom) * 100.0
                    elif num is not None:
                        eff_val = (num / denom) * 100.0
                if eff_val is not None:
                    try:
                        eff_val = max(0.0, min(100.0, round(float(eff_val) * 10.0) / 10.0))
                        if eff_val == 100.0 and stages_sum and stages_sum < denom:
                            eff_val = max(0.0, min(100.0, round((stages_sum / denom) * 100.0 * 10.0) / 10.0))
                        if eff_val == 100.0 and (awake_sec is None or float(awake_sec) == 0.0) and (not stages_sum or float(stages_sum) == 0.0):
                            if denom and num is not None and abs(float(denom) - float(num)) < 60:
                                item['efficiency_pct'] = None
                            else:
                                item['efficiency_pct'] = eff_val
                        else:
                            item['efficiency_pct'] = eff_val
                    except Exception:
                        item['efficiency_pct'] = None
                else:
                    item['efficiency_pct'] = None
            except Exception:
                item['efficiency_pct'] = None
            # Formatting
            if item.get('day'):
                item['day'] = item['day'].isoformat()
            for k in ['sleep_start', 'sleep_end']:
                if item.get(k):
                    item[k] = item[k].isoformat()
            if item.get('sleep_duration_seconds') is not None:
                item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
            if r.get('avg_sleep_hr') is not None:
                item['avg_sleep_hr'] = r.get('avg_sleep_hr')
            if r.get('avg_sleep_rr') is not None:
                item['avg_sleep_rr'] = r.get('avg_sleep_rr')
            if r.get('avg_sleep_stress') is not None:
                item['avg_sleep_stress'] = r.get('avg_sleep_stress')
            if r.get('last_sleep_phase') is not None:
                item['last_sleep_phase'] = r.get('last_sleep_phase')

            # Fetch events
            sleep_events = []
            try:
                start_dt = r.get('sleep_start')
                end_dt = r.get('sleep_end')
                if start_dt and end_dt:
                    ev_rows = execute_query(
                        """
                        SELECT timestamp, event, duration
                        FROM garmin_sleep_events
                        WHERE timestamp >= %s AND timestamp <= %s
                        ORDER BY timestamp
                        """,
                        (start_dt, end_dt)
                    ) or []
                    for er in ev_rows:
                        ts = er.get('timestamp')
                        dur = er.get('duration')
                        dur_sec = None
                        try:
                            if hasattr(dur, 'total_seconds'):
                                dur_sec = int(dur.total_seconds())
                            else:
                                from datetime import time as _time
                                if isinstance(dur, _time):
                                    dur_sec = int(dur.hour) * 3600 + int(dur.minute) * 60 + int(dur.second)
                                elif isinstance(dur, (int, float)):
                                    dur_sec = int(dur)
                                elif isinstance(dur, str):
                                    s = dur.strip()
                                    if s.isdigit():
                                        dur_sec = int(s)
                                    else:
                                        parts = s.split(':')
                                        if len(parts) >= 2:
                                            h = int(parts[0] or 0)
                                            m = int(parts[1] or 0)
                                            sec_part = parts[2] if len(parts) > 2 else '0'
                                            sec = int(sec_part.split('.')[0]) if sec_part else 0
                                            dur_sec = h*3600 + m*60 + sec
                        except Exception:
                            dur_sec = None
                        sleep_events.append({'timestamp': ts.isoformat() if ts else None, 'event': er.get('event'), 'duration_sec': dur_sec})
            except Exception:
                sleep_events = []
            item['sleep_events'] = sleep_events
            res.append(item)
        return jsonify({'sleeps': res, 'count': len(res), 'total_count': total_count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sleeps_bp.get("/sleeps/<int:sleep_id>")
def get_sleep_detail(sleep_id: int):
    try:
        row = execute_query(
            """
            SELECT *
            FROM garmin_sleep_sessions
            WHERE sleep_id = %s
            """,
            (sleep_id,),
            fetch_one=True,
        )
        if not row:
            return jsonify({'error': 'Sleep session not found'}), 404
        item = dict(row)
        start_dt = row.get('sleep_start')
        end_dt = row.get('sleep_end')
        if item.get('day'):
            item['day'] = item['day'].isoformat()
        for k in ['sleep_start', 'sleep_end']:
            if item.get(k):
                item[k] = item[k].isoformat()
        if item.get('sleep_duration_seconds') is not None:
            item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
        total = max((item.get('sleep_duration_seconds') or 0), 1)
        for k in ['deep_sleep_seconds', 'light_sleep_seconds', 'rem_sleep_seconds', 'awake_seconds']:
            if item.get(k) is not None:
                item[k.replace('_seconds','_pct')] = round((item[k] / total) * 100.0, 1)
        # normalize RR field
        for alt in ('avg_sleep_rr','avg_respiration','respiratory_rate','respRate'):
            if row.get(alt) is not None:
                item['avg_sleep_rr'] = row.get(alt)
                item['respiratory_rate'] = row.get(alt)
                break
        # events and series
        hr_series, stress_series, rr_series = [], [], []
        if start_dt and end_dt and end_dt > start_dt:
            try:
                hr_rows = execute_query(
                    """
                    SELECT ts, bpm
                    FROM garmin_heart_rate_data
                    WHERE ts >= %s AND ts <= %s
                    ORDER BY ts
                    """,
                    (start_dt, end_dt)
                ) or []
                hr_series = [{'ts': r['ts'].isoformat() if r.get('ts') else None, 'bpm': r.get('bpm')} for r in hr_rows]
            except Exception:
                hr_series = []
            try:
                stress_rows = execute_query(
                    """
                    SELECT ts, stress
                    FROM garmin_stress_data
                    WHERE ts >= %s AND ts <= %s
                    ORDER BY ts
                    """,
                    (start_dt, end_dt)
                ) or []
                stress_series = [{'ts': r['ts'].isoformat() if r.get('ts') else None, 'stress': r.get('stress')} for r in stress_rows]
            except Exception:
                stress_series = []
            try:
                rr_rows = execute_query(
                    """
                    SELECT ts, rr
                    FROM garmin_respiratory_rate_data
                    WHERE ts >= %s AND ts <= %s
                    ORDER BY ts
                    """,
                    (start_dt, end_dt)
                ) or []
                rr_series = [{'ts': r['ts'].isoformat() if r.get('ts') else None, 'rr': r.get('rr')} for r in rr_rows]
            except Exception:
                rr_series = []
        item['hr_series'] = hr_series
        item['stress_series'] = stress_series
        item['rr_series'] = rr_series
        if row.get('last_sleep_phase') is not None:
            item['last_sleep_phase'] = row.get('last_sleep_phase')
        return jsonify({'sleep': item})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
