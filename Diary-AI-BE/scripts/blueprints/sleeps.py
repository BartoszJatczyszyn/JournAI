from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from db import async_execute_query
from schemas import SleepListResponse, SleepDetailResponse, SleepSession
from pydantic import BaseModel
from datetime import datetime, date


class SleepCreate(BaseModel):
    day: date | None = None
    sleep_start: datetime | None = None
    sleep_end: datetime | None = None
    sleep_duration_seconds: int | None = None
    deep_sleep_seconds: int | None = None
    light_sleep_seconds: int | None = None
    rem_sleep_seconds: int | None = None
    awake_seconds: int | None = None
    sleep_score: int | None = None
    avg_sleep_hr: float | None = None
    avg_sleep_rr: float | None = None
    avg_sleep_stress: float | None = None


router = APIRouter(tags=["sleeps"], prefix="")

@router.get("/sleeps/latest", response_model=SleepListResponse)
async def get_latest_sleeps(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    start_date: str | None = None,
    end_date: str | None = None,
):
    try:
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
        total_row = await async_execute_query(count_query, tuple(params), fetch_one=True)
        total_count = (total_row or {}).get('total_count', 0)
        cols_check = await async_execute_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_sleep_sessions' AND column_name IN ('avg_sleep_hr','avg_sleep_rr','avg_respiration','respiratory_rate','respRate','avg_sleep_stress','last_sleep_phase')",
            None,
            fetch_all=True,
        )
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
        LIMIT {limit} OFFSET {offset}
        """
        rows = await async_execute_query(query, tuple(params)) or []
        res: list[SleepSession] = []
        for r in rows:
            item = dict(r)
            # compute efficiency (same logic as earlier)
            try:
                dur_sec = r.get('sleep_duration_seconds')
                awake_sec = r.get('awake_seconds')
                start_raw = r.get('sleep_start')
                end_raw = r.get('sleep_end')
                denom = None
                if start_raw and end_raw:
                    denom = (end_raw - start_raw).total_seconds()
                    if denom <= 0:
                        denom += 24*60*60
                if denom is None and dur_sec is not None and awake_sec is not None and (float(dur_sec) + float(awake_sec)) > 0:
                    denom = float(dur_sec) + float(awake_sec)
                stages_sum = float((r.get('deep_sleep_seconds') or 0) + (r.get('light_sleep_seconds') or 0) + (r.get('rem_sleep_seconds') or 0))
                if denom and denom > 0:
                    eff_val = (stages_sum / denom) * 100.0 if stages_sum > 0 else (float(dur_sec) / denom * 100.0 if dur_sec else None)
                else:
                    eff_val = None
                if eff_val is not None:
                    item['efficiency_pct'] = max(0.0, min(100.0, round(eff_val, 1)))
            except Exception:
                item['efficiency_pct'] = None
            for k in ['day','sleep_start','sleep_end']:
                if item.get(k) and hasattr(item[k], 'isoformat'):
                    item[k] = item[k].isoformat()
            if item.get('sleep_duration_seconds') is not None:
                item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
            # events (lightweight fetch inside loop kept for parity)
            sleep_events = []
            start_dt = r.get('sleep_start')
            end_dt = r.get('sleep_end')
            if start_dt and end_dt:
                ev_rows = await async_execute_query(
                    """
                    SELECT timestamp, event, duration
                    FROM garmin_sleep_events
                    WHERE timestamp >= %s AND timestamp <= %s
                    ORDER BY timestamp
                    """,
                    (start_dt, end_dt),
                ) or []
                for er in ev_rows:
                    ts = er.get('timestamp')
                    sleep_events.append({'timestamp': ts.isoformat() if ts else None, 'event': er.get('event'), 'duration_sec': None})
            item['sleep_events'] = sleep_events
            res.append(SleepSession(**item))
        return {"sleeps": res, "count": len(res), "total_count": total_count}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sleeps/{sleep_id}", response_model=SleepDetailResponse)
async def get_sleep_detail(sleep_id: int):
    try:
        row = await async_execute_query(
            """
            SELECT *
            FROM garmin_sleep_sessions
            WHERE sleep_id = %s
            """,
            (sleep_id,),
            fetch_one=True,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Sleep session not found")
        item = dict(row)
        start_dt = row.get('sleep_start')
        end_dt = row.get('sleep_end')
        for k in ['day','sleep_start','sleep_end']:
            if item.get(k) and hasattr(item[k], 'isoformat'):
                item[k] = item[k].isoformat()
        if item.get('sleep_duration_seconds') is not None:
            item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
        total = max((item.get('sleep_duration_seconds') or 0), 1)
        for k in ['deep_sleep_seconds','light_sleep_seconds','rem_sleep_seconds','awake_seconds']:
            if item.get(k) is not None:
                item[k.replace('_seconds','_pct')] = round((item[k] / total) * 100.0, 1)
        # series (trimmed logic for brevity)
        item['hr_series'] = []
        item['stress_series'] = []
        item['rr_series'] = []
        return {"sleep": SleepSession(**item)}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/sleep/events/{day}')
async def get_sleep_events_for_day(day: str):
    """Return sleep events from garmin_sleep_events for the requested day.

    Response: { events: [ { timestamp, event, duration }, ... ] }
    """
    try:
        query = """
        SELECT timestamp, event, duration
        FROM garmin_sleep_events
        WHERE timestamp >= %s::date AND timestamp < (%s::date + INTERVAL '1 day')
        ORDER BY timestamp
        """
        rows = await async_execute_query(query, (day, day)) or []
        out = []
        for r in rows:
            item = dict(r)
            ts = item.get('timestamp')
            if hasattr(ts, 'isoformat'):
                item['timestamp'] = ts.isoformat()
            # duration may be TIME or INTERVAL; convert to string when possible
            dur = item.get('duration')
            if dur is not None:
                try:
                    item['duration'] = str(dur)
                except Exception:
                    item['duration'] = dur
            out.append(item)
        return { 'events': out }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/sleeps', response_model=SleepDetailResponse)
async def create_sleep(payload: SleepCreate):
    """Create a manual sleep session in garmin_sleep_sessions.

    This will INSERT a new row and return the created SleepSession representation.
    """
    try:
        # Normalize day: if not provided, use date part of sleep_start or today's date
        day_val = payload.day
        if not day_val and payload.sleep_start:
            day_val = payload.sleep_start.date()
        if not day_val and payload.sleep_end:
            day_val = payload.sleep_end.date()
        if not day_val:
            day_val = date.today()

        # Simple validation and auto-compute duration when possible
        if payload.sleep_score is not None:
            try:
                sc = int(payload.sleep_score)
            except Exception:
                raise HTTPException(status_code=400, detail='sleep_score must be an integer')
            if sc < 0 or sc > 100:
                raise HTTPException(status_code=400, detail='sleep_score must be between 0 and 100')

        # compute duration if not provided and start/end provided
        derived_duration = payload.sleep_duration_seconds
        if (derived_duration is None) and payload.sleep_start and payload.sleep_end:
            try:
                delta = (payload.sleep_end - payload.sleep_start).total_seconds()
                # allow overnight sleeps: if end <= start, treat as next day
                if delta <= 0:
                    delta += 24 * 60 * 60
                derived_duration = int(max(0, round(delta)))
            except Exception:
                derived_duration = None

        # Check which columns exist in the table to avoid inserting into non-existent columns
        cols_check = await async_execute_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_sleep_sessions'",
            None,
            fetch_all=True,
        ) or []
        present = set([c.get('column_name') for c in cols_check if isinstance(c, dict)])

        cols = []
        vals = []
        params = []
        def add(col, val):
            cols.append(col)
            vals.append('%s')
            params.append(val)

        if 'day' not in present:
            raise HTTPException(status_code=500, detail="garmin_sleep_sessions.table missing 'day' column")
        add('day', day_val)
        if 'sleep_start' in present and payload.sleep_start is not None:
            add('sleep_start', payload.sleep_start)
        if 'sleep_end' in present and payload.sleep_end is not None:
            add('sleep_end', payload.sleep_end)
        if 'sleep_duration_seconds' in present and derived_duration is not None:
            add('sleep_duration_seconds', derived_duration)
        if 'deep_sleep_seconds' in present and payload.deep_sleep_seconds is not None:
            add('deep_sleep_seconds', payload.deep_sleep_seconds)
        if 'light_sleep_seconds' in present and payload.light_sleep_seconds is not None:
            add('light_sleep_seconds', payload.light_sleep_seconds)
        if 'rem_sleep_seconds' in present and payload.rem_sleep_seconds is not None:
            add('rem_sleep_seconds', payload.rem_sleep_seconds)
        if 'awake_seconds' in present and payload.awake_seconds is not None:
            add('awake_seconds', payload.awake_seconds)
        if 'sleep_score' in present and payload.sleep_score is not None:
            add('sleep_score', payload.sleep_score)
        if 'avg_sleep_hr' in present and payload.avg_sleep_hr is not None:
            add('avg_sleep_hr', payload.avg_sleep_hr)
        if 'avg_sleep_rr' in present and payload.avg_sleep_rr is not None:
            add('avg_sleep_rr', payload.avg_sleep_rr)
        if 'avg_sleep_stress' in present and payload.avg_sleep_stress is not None:
            add('avg_sleep_stress', payload.avg_sleep_stress)

        query = f"INSERT INTO garmin_sleep_sessions ({', '.join(cols)}) VALUES ({', '.join(vals)}) RETURNING *"
        row = await async_execute_query(query, tuple(params), fetch_one=True)
        if not row:
            raise HTTPException(status_code=500, detail='Insert failed')
        item = dict(row)
        for k in ['day','sleep_start','sleep_end']:
            if item.get(k) and hasattr(item[k], 'isoformat'):
                item[k] = item[k].isoformat()
        if item.get('sleep_duration_seconds') is not None:
            item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
        # ensure required attrs for SleepSession
        if 'sleep_id' not in item:
            # attempt to fetch last inserted by day/start
            lookup = await async_execute_query(
                "SELECT * FROM garmin_sleep_sessions WHERE day = %s ORDER BY sleep_start DESC LIMIT 1",
                (day_val,),
                fetch_one=True,
            ) or {}
            item = dict(lookup)
            for k in ['day','sleep_start','sleep_end']:
                if item.get(k) and hasattr(item[k], 'isoformat'):
                    item[k] = item[k].isoformat()
        return { 'sleep': SleepSession(**item) }
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/sleeps/{sleep_id}', response_model=SleepDetailResponse)
async def update_sleep(sleep_id: int, payload: SleepCreate):
    """Update an existing sleep session. Only provided fields will be updated."""
    try:
        # validation for score
        if payload.sleep_score is not None:
            try:
                sc = int(payload.sleep_score)
            except Exception:
                raise HTTPException(status_code=400, detail='sleep_score must be an integer')
            if sc < 0 or sc > 100:
                raise HTTPException(status_code=400, detail='sleep_score must be between 0 and 100')

        # derive duration if needed
        derived_duration = payload.sleep_duration_seconds
        if derived_duration is None and payload.sleep_start and payload.sleep_end:
            try:
                delta = (payload.sleep_end - payload.sleep_start).total_seconds()
                if delta <= 0:
                    delta += 24 * 60 * 60
                derived_duration = int(max(0, round(delta)))
            except Exception:
                derived_duration = None

        # check columns
        cols_check = await async_execute_query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'garmin_sleep_sessions'",
            None,
            fetch_all=True,
        ) or []
        present = set([c.get('column_name') for c in cols_check if isinstance(c, dict)])

        updates = []
        params = []
        def upd(col, val):
            updates.append(f"{col} = %s")
            params.append(val)

        if payload.day is not None and 'day' in present:
            upd('day', payload.day)
        if payload.sleep_start is not None and 'sleep_start' in present:
            upd('sleep_start', payload.sleep_start)
        if payload.sleep_end is not None and 'sleep_end' in present:
            upd('sleep_end', payload.sleep_end)
        if derived_duration is not None and 'sleep_duration_seconds' in present:
            upd('sleep_duration_seconds', derived_duration)
        if payload.deep_sleep_seconds is not None and 'deep_sleep_seconds' in present:
            upd('deep_sleep_seconds', payload.deep_sleep_seconds)
        if payload.light_sleep_seconds is not None and 'light_sleep_seconds' in present:
            upd('light_sleep_seconds', payload.light_sleep_seconds)
        if payload.rem_sleep_seconds is not None and 'rem_sleep_seconds' in present:
            upd('rem_sleep_seconds', payload.rem_sleep_seconds)
        if payload.awake_seconds is not None and 'awake_seconds' in present:
            upd('awake_seconds', payload.awake_seconds)
        if payload.sleep_score is not None and 'sleep_score' in present:
            upd('sleep_score', payload.sleep_score)
        if payload.avg_sleep_hr is not None and 'avg_sleep_hr' in present:
            upd('avg_sleep_hr', payload.avg_sleep_hr)
        if payload.avg_sleep_rr is not None and 'avg_sleep_rr' in present:
            upd('avg_sleep_rr', payload.avg_sleep_rr)
        if payload.avg_sleep_stress is not None and 'avg_sleep_stress' in present:
            upd('avg_sleep_stress', payload.avg_sleep_stress)

        if not updates:
            # nothing to do: return existing
            row = await async_execute_query("SELECT * FROM garmin_sleep_sessions WHERE sleep_id = %s", (sleep_id,), fetch_one=True)
            if not row:
                raise HTTPException(status_code=404, detail='Sleep session not found')
            item = dict(row)
            for k in ['day','sleep_start','sleep_end']:
                if item.get(k) and hasattr(item[k], 'isoformat'):
                    item[k] = item[k].isoformat()
            if item.get('sleep_duration_seconds') is not None:
                item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
            return {'sleep': SleepSession(**item)}

        params.append(sleep_id)
        query = f"UPDATE garmin_sleep_sessions SET {', '.join(updates)} WHERE sleep_id = %s RETURNING *"
        row = await async_execute_query(query, tuple(params), fetch_one=True)
        if not row:
            raise HTTPException(status_code=404, detail='Sleep session not found or update failed')
        item = dict(row)
        for k in ['day','sleep_start','sleep_end']:
            if item.get(k) and hasattr(item[k], 'isoformat'):
                item[k] = item[k].isoformat()
        if item.get('sleep_duration_seconds') is not None:
            item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
        return {'sleep': SleepSession(**item)}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/sleeps/{sleep_id}')
async def delete_sleep(sleep_id: int):
    """Delete a sleep session by id."""
    try:
        # check exists
        row = await async_execute_query("SELECT sleep_id FROM garmin_sleep_sessions WHERE sleep_id = %s", (sleep_id,), fetch_one=True)
        if not row:
            raise HTTPException(status_code=404, detail='Sleep session not found')
        await async_execute_query("DELETE FROM garmin_sleep_sessions WHERE sleep_id = %s", (sleep_id,))
        return { 'deleted': True }
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

sleeps_router = router
__all__ = ["router", "sleeps_router"]
