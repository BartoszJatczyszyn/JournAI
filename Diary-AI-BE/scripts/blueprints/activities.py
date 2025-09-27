#!/usr/bin/env python3
"""Activities blueprint: list and detail of activities.

Single Responsibility:
- Handle HTTP routing and request/response shaping for activities endpoints.

Open/Closed:
- New routes can be added here without modifying other modules.

Dependency Inversion:
- Depends on abstracted DB access via execute_query, not concrete DB driver.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from db import execute_query

activities_bp = Blueprint("activities", __name__)


@activities_bp.get("/latest")
def get_latest_activities():
    try:
        limit = request.args.get('limit', 20, type=int)
        query = """
        SELECT 
            activity_id,
            name,
            sport,
            sub_sport,
            start_time,
            stop_time,
            elapsed_time,
            distance,
            calories,
            avg_hr,
            max_hr
        FROM garmin_activities
        WHERE start_time IS NOT NULL
        ORDER BY start_time DESC
        LIMIT %s
        """
        rows = execute_query(query, (limit,))
        res = []
        for r in rows or []:
            item = dict(r)
            # format times
            if item.get('start_time'):
                item['start_time'] = item['start_time'].isoformat()
            if item.get('stop_time'):
                item['stop_time'] = item['stop_time'].isoformat()
            # convert units
            if item.get('distance') is not None:
                item['distance_km'] = round((item['distance'] or 0) / 1000.0, 2)
            if item.get('elapsed_time') is not None:
                item['duration_min'] = round((item['elapsed_time'] or 0) / 60.0, 1)
            res.append(item)
        return jsonify({'activities': res, 'count': len(res)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@activities_bp.get("/<int:activity_id>")
def get_activity_detail(activity_id: int):
    try:
        query = """
        SELECT *
        FROM garmin_activities
        WHERE activity_id = %s
        """
        row = execute_query(query, (activity_id,), fetch_one=True)
        if not row:
            return jsonify({'error': 'Activity not found'}), 404
        item = dict(row)
        # derived and formatted
        for k in ['start_time', 'stop_time']:
            if item.get(k):
                item[k] = item[k].isoformat()
        if item.get('distance') is not None:
            item['distance_km'] = round((item['distance'] or 0) / 1000.0, 2)
        if item.get('elapsed_time') is not None:
            item['duration_min'] = round((item['elapsed_time'] or 0) / 60.0, 1)
        if item.get('avg_speed') is not None and item['avg_speed']:
            # pace min/km
            try:
                pace = (1000.0 / item['avg_speed']) / 60.0
                item['avg_pace_min_per_km'] = round(pace, 2)
            except Exception:
                pass
        return jsonify({'activity': item})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
