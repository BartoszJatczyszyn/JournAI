from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from datetime import time as time_type
from domain.repositories.activities import IActivitiesRepository

class ActivitiesService:
    def __init__(self, repo: IActivitiesRepository) -> None:
        self.repo = repo

    async def latest(self, limit: int, start_date: Optional[str], end_date: Optional[str]) -> List[Dict[str, Any]]:
        where_clauses = ["start_time IS NOT NULL"]
        params: List[Any] = []
        if start_date:
            where_clauses.append("start_time >= %s")
            params.append(start_date)
        if end_date:
            where_clauses.append("start_time <= %s")
            params.append(end_date)
        where_sql = " AND ".join(where_clauses)
        rows = await self.repo.fetch_latest(where_sql, tuple(params), limit)
        out: List[Dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            st = item.get('start_time')
            d = item.get('day')
            if hasattr(st, 'isoformat'):
                item['start_time'] = st.isoformat()
            if hasattr(d, 'isoformat'):
                item['day'] = d.isoformat()
            # Normalize fields expected by frontend consumers
            try:
                if item.get('distance_km') is None and item.get('distance') is not None:
                    item['distance_km'] = float(item.get('distance') or 0)
            except Exception:
                pass
            try:
                if item.get('duration_min') is None and item.get('elapsed_time_seconds') is not None:
                    item['duration_min'] = round((float(item.get('elapsed_time_seconds') or 0) / 60.0), 1)
            except Exception:
                pass
            pace = item.get('avg_pace')
            if pace is None:
                speed = item.get('avg_speed')
                dist = item.get('distance') or item.get('distance_km') or 0
                elapsed = item.get('elapsed_time_seconds') or 0
                if speed:
                    try:
                        speed_f = float(speed)
                        if speed_f > 0:
                            item['avg_pace'] = 60.0 / speed_f
                    except Exception:
                        pass
                elif dist and elapsed:
                    try:
                        dist_f = float(dist)
                        elapsed_f = float(elapsed)
                        if dist_f > 0:
                            item['avg_pace'] = (elapsed_f / 60.0) / dist_f
                    except Exception:
                        pass
            else:
                if isinstance(pace, time_type):
                    item['avg_pace'] = pace.hour * 60 + pace.minute + pace.second / 60.0
                elif isinstance(pace, str):
                    parts = [int(p) for p in pace.split(":") if p.isdigit()]
                    if parts:
                        mm = 0
                        if len(parts) == 3:
                            mm = parts[0]*60 + parts[1]
                            ss = parts[2]
                        elif len(parts) == 2:
                            mm = parts[0]
                            ss = parts[1]
                        else:
                            ss = 0
                        item['avg_pace'] = mm + (ss/60.0 if isinstance(ss, (int,float)) else 0)
                else:
                    try:
                        item['avg_pace'] = float(pace)
                    except Exception:
                        pass
            out.append(item)
        return out

    async def detail(self, activity_id: int) -> Dict[str, Any]:
        row = await self.repo.get_detail(activity_id)
        if not row:
            raise LookupError('not found')
        item = dict(row)
        st = item.get('start_time')
        et = item.get('stop_time')
        if hasattr(st, 'isoformat'):
            item['start_time'] = st.isoformat()
        if hasattr(et, 'isoformat'):
            item['stop_time'] = et.isoformat()
        if item.get('distance') is not None:
            try:
                item['distance_km'] = round((float(item['distance']) or 0) / 1000.0, 2)
            except Exception:
                pass
        if item.get('elapsed_time') is not None:
            try:
                item['duration_min'] = round((float(item['elapsed_time']) or 0) / 60.0, 1)
            except Exception:
                pass
        if item.get('avg_speed'):
            try:
                item['avg_pace'] = round(60.0 / float(item['avg_speed']), 2)
            except Exception:
                pass
        return item

    async def debug_overview(self, days: int) -> Dict[str, Any]:
        total, with_pace = await self.repo.debug_counts(days)
        sample = await self.repo.debug_sample(days)
        all_cnt = await self.repo.count_all()
        running_total = await self.repo.count_running_total()
        return {
            'total_count': all_cnt,
            'running_total': running_total,
            'running_count': total,
            'running_with_pace': with_pace,
            'raw_sample': sample,
        }

__all__ = ["ActivitiesService"]
