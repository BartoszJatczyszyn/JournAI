#!/usr/bin/env python3
"""FastAPI application bootstrap (migrated from Flask).

Responsibilities:
  * Load environment variables (config.env)
  * Create FastAPI instance with CORS middleware
  * Include modular routers (analytics, predictions, insights, activities, sleeps, trends, admin, core)
  * Expose `app` for uvicorn / programmatic startup

Route compatibility:
  Original Flask blueprint prefixes are preserved so existing frontend paths (/api/...) keep working.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load env early
load_dotenv("config.env")

app = FastAPI(title="Diary AI Backend", version="2.0.0", openapi_url="/api/openapi.json", docs_url="/api/docs")
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # pragma: no cover
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {"code": "internal_error", "message": str(exc) or "Internal Server Error"},
            "code": 500,
        },
    )

from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):  # pragma: no cover
    code_map = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "validation_error"}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {"code": code_map.get(exc.status_code, "error"), "message": exc.detail},
            "code": exc.status_code,
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):  # pragma: no cover
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {"code": "validation_error", "message": "Validation failed", "details": exc.errors()},
            "code": 422,
        },
    )

# CORS (broad during migration; tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers (converted from Flask blueprints)
from blueprints import (
    analytics_router,
    predictions_router,
    activities_router,
    sleeps_router,
    core_router,
    admin_router,
    insights_router,
    trends_router,
    journal_router,
    gym_router,
)

# Include routers preserving original external paths
app.include_router(core_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(predictions_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(activities_router, prefix="/api")
app.include_router(sleeps_router, prefix="/api")
app.include_router(trends_router, prefix="/api")
app.include_router(journal_router, prefix="/api")
app.include_router(gym_router, prefix="/api")


@app.get("/api/health", tags=["system"], summary="Service health check")
def health_check():  # pragma: no cover - trivial
    return {"status": "ok"}


@app.get("/api/analytics/info", tags=["system"], summary="Capabilities overview")
def analytics_info():  # pragma: no cover - static
    return {
        "service": "Diary AI Backend",
        "capabilities": [
            "Advanced correlations",
            "Clustering",
            "Temporal patterns",
            "Recovery analysis",
            "Specialized sleep/stress/activity",
            "Predictive analytics",
            "Personalized insights",
            "Period comparisons",
            "Health trends",
        ],
        "version": "2.0.0",
    }


@app.get("/api/weight/current", tags=["weight"], summary="Get latest recorded weight")
def current_weight():
    """Return the most recent weight entry from garmin_weight.

    Response shape:
      { "day": ISO date, "weight_kg": float | None, "bmi": float | None, "source": "garmin_weight" }
    404 if no weight rows exist.
    """
    from db import execute_query  # local import to avoid circulars
    row = execute_query(
        "SELECT day, weight_kg, bmi, body_fat_percentage, muscle_mass_kg, body_water_percentage FROM garmin_weight WHERE weight_kg IS NOT NULL ORDER BY day DESC LIMIT 1",
        (),
        fetch_one=True,
    )
    if not row:
        # fallback: maybe table empty or only null weights
        empty = execute_query("SELECT day FROM garmin_weight ORDER BY day DESC LIMIT 1", (), fetch_one=True)
        if not empty:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="no weight data")
        day = empty.get("day")
        if hasattr(day, "isoformat"):
            day = day.isoformat()
        return {"day": day, "weight_kg": None, "bmi": None, "body_fat_percentage": None, "muscle_mass_kg": None, "body_water_percentage": None, "source": "garmin_weight"}
    day = row.get("day")
    if hasattr(day, "isoformat"):
        day = day.isoformat()
    return {
        "day": day,
        "weight_kg": row.get("weight_kg"),
        "bmi": row.get("bmi"),
        "body_fat_percentage": row.get("body_fat_percentage"),
        "muscle_mass_kg": row.get("muscle_mass_kg"),
        "body_water_percentage": row.get("body_water_percentage"),
        "source": "garmin_weight",
    }


@app.get("/api/weight/history", tags=["weight"], summary="Get recent weight history")
def weight_history(days: int = 90):
    """Return up to `days` days of weight records (descending by day).

    Params:
      days: window size (1-365)
    Response: list[{day, weight_kg, bmi}]
    """
    from db import execute_query
    days = max(1, min(int(days or 90), 365))
    rows = execute_query(
        """
        SELECT day, weight_kg, bmi, body_fat_percentage, muscle_mass_kg, body_water_percentage
        FROM garmin_weight
        WHERE weight_kg IS NOT NULL
        ORDER BY day DESC
        LIMIT %s
        """,
        (days,),
        fetch_all=True,
    ) or []
    out = []
    for r in rows:
        d = r.get("day")
        if hasattr(d, "isoformat"):
            d = d.isoformat()
        out.append({
            "day": d,
            "weight_kg": r.get("weight_kg"),
            "bmi": r.get("bmi"),
            "body_fat_percentage": r.get("body_fat_percentage"),
            "muscle_mass_kg": r.get("muscle_mass_kg"),
            "body_water_percentage": r.get("body_water_percentage"),
        })
    return out


@app.get("/api/weight/stats", tags=["weight"], summary="Weight aggregates and trends")
def weight_stats():
    """Return aggregates: latest, 7d / 30d averages, deltas, simple trend slope.

    trend_7d_slope: linear regression slope (kg per day) over last up to 7 entries.
    """
    from db import execute_query
    rows = execute_query(
        """
        SELECT day, weight_kg FROM garmin_weight
        WHERE weight_kg IS NOT NULL
        ORDER BY day DESC
        LIMIT 40
        """,
        (),
        fetch_all=True,
    ) or []
    if not rows:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="no weight data")
    # Normalize
    norm = []
    for r in rows:
        d = r["day"]
        if hasattr(d, "isoformat"):
            d = d.isoformat()
        norm.append({"day": d, "weight_kg": r["weight_kg"]})
    latest = norm[0]
    # Compute simple averages using entries (not calendar days)
    import statistics, math
    last7 = [r["weight_kg"] for r in norm[:7] if r.get("weight_kg") is not None]
    last30 = [r["weight_kg"] for r in norm[:30] if r.get("weight_kg") is not None]
    avg7 = statistics.fmean(last7) if last7 else None
    avg30 = statistics.fmean(last30) if last30 else None
    delta_from_7d = (latest["weight_kg"] - avg7) if (avg7 is not None) else None
    delta_from_30d = (latest["weight_kg"] - avg30) if (avg30 is not None) else None
    # Trend slope (simple linear regression) over up to 7 entries (x=0..n-1 descending order)
    trend7_slice = list(reversed(norm[:7]))  # oldest to newest
    slope = None
    if len(trend7_slice) >= 2:
        xs = list(range(len(trend7_slice)))
        ys = [r["weight_kg"] for r in trend7_slice]
        n = len(xs)
        mean_x = sum(xs)/n
        mean_y = sum(ys)/n
        denom = sum((x-mean_x)**2 for x in xs)
        if denom > 0:
            slope = sum((x-mean_x)*(y-mean_y) for x,y in zip(xs,ys)) / denom
    return {
        "latest": latest,
        "avg_7d": avg7,
        "avg_30d": avg30,
        "delta_from_7d": delta_from_7d,
        "delta_from_30d": delta_from_30d,
        "trend_7d_slope": slope,  # kg per day
        "sample_sizes": {"entries_7d": len(last7), "entries_30d": len(last30)},
    }


@app.get("/api/weight/correlations", tags=["weight"], summary="Correlations of weight with key metrics")
def weight_correlations(days: int = 90, min_abs: float = 0.0):
    """Compute Pearson correlations between weight_kg and selected metrics over last N days.

    Metrics considered: energy_level, mood, stress_level_manual, sleep_score, steps, resting_heart_rate.
    Returns list sorted by absolute correlation descending.
    """
    from db import execute_query
    days = max(7, min(int(days or 90), 365))
    rows = execute_query(
        f"""
        SELECT w.weight_kg, j.energy_level, j.mood, j.stress_level_manual, ds.sleep_score,
               ds.steps, ds.resting_heart_rate
        FROM garmin_weight w
        LEFT JOIN daily_journal j ON j.day = w.day
        LEFT JOIN garmin_daily_summaries ds ON ds.day = w.day
        WHERE w.weight_kg IS NOT NULL
          AND w.day >= (CURRENT_DATE - INTERVAL '{days} day')
        ORDER BY w.day DESC
        """,
        (),
        fetch_all=True,
    ) or []
    if not rows:
        return {"days": days, "pairs": [], "sample_size": 0}

    # Prepare series
    import math
    metrics = [
        ("energy_level", "energy"),
        ("mood", "mood"),
        ("stress_level_manual", "stress_manual"),
        ("sleep_score", "sleep_score"),
        ("steps", "steps"),
        ("resting_heart_rate", "resting_hr"),
    ]
    weight_series = [r["weight_kg"] for r in rows if r.get("weight_kg") is not None]
    def pearson(a, b):
        paired = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
        n = len(paired)
        if n < 3:
            return None, n
        xs = [p[0] for p in paired]
        ys = [p[1] for p in paired]
        mean_x = sum(xs) / n
        mean_y = sum(ys) / n
        num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
        den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
        den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
        if den_x == 0 or den_y == 0:
            return None, n
        return num / (den_x * den_y), n

    out = []
    for field, label in metrics:
        series = [r.get(field) for r in rows]
        r_val, n_used = pearson(weight_series, series)
        if r_val is None:
            continue
        if abs(r_val) >= float(min_abs):
            out.append({
                "metric": label,
                "pearson_r": round(r_val, 3),
                "n": n_used,
            })
    out.sort(key=lambda d: abs(d["pearson_r"]), reverse=True)
    return {"days": days, "pairs": out, "sample_size": len(weight_series)}


__all__ = ["app"]

