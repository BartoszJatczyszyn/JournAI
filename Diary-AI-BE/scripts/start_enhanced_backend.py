#!/usr/bin/env python3
"""Startup for Enhanced Analytics Backend.

Modernized for Python 3.13 with logging, argparse, and utilities.
"""
from __future__ import annotations

import argparse
from contextlib import closing, suppress
import importlib
import subprocess
import sys
import time

from utils import DbConfig, get_logger, load_env, setup_logging

LOGGER = get_logger("start_enhanced_backend")


def check_dependencies(auto_install: bool = True) -> bool:
    """Check required dependencies, optionally auto-install missing ones."""
    LOGGER.info("🔍 Checking dependencies...")

    required = [
        ("numpy", "numpy"),
        ("scipy", "scipy"),
        ("sklearn", "scikit-learn"),
        ("psycopg", "psycopg[binary]"),
        ("flask", "flask"),
        ("flask_cors", "flask-cors"),
        ("dotenv", "python-dotenv"),
    ]

    missing: list[str] = []
    for module_name, pip_name in required:
        with suppress(ImportError):
            importlib.import_module(module_name)
            LOGGER.debug("   ✅ %s", module_name)
            continue
        LOGGER.warning("   ❌ %s (missing)", module_name)
        missing.append(pip_name)

    if not missing:
        LOGGER.info("✅ All dependencies satisfied")
        return True

    if not auto_install:
        LOGGER.error("Missing packages: %s", ", ".join(missing))
        return False

    LOGGER.warning("⚠️  Missing packages detected. Installing...")
    for package in missing:
        LOGGER.info("   Installing %s ...", package)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            LOGGER.info("   ✅ %s installed", package)
        except subprocess.CalledProcessError as exc:
            LOGGER.error("   ❌ Failed to install %s: %s", package, exc)
            return False

    LOGGER.info("✅ All dependencies installed")
    return True


def check_database_connection() -> bool:
    """Check database connection using environment variables."""
    LOGGER.info("🗄️  Checking database connection...")
    try:
        from db import get_connection
        load_env("config.env")
        with get_connection() as _:
            pass
        LOGGER.info("✅ Database connection successful")
        return True
    except Exception as exc:  # pragma: no cover
        LOGGER.error("❌ Database connection failed: %s", exc)
        try:
            from utils import load_env as _load
            _load("config.env")
            cfg = DbConfig()
            LOGGER.info("💡 Make sure: \n   • PostgreSQL is running\n   • config.env has correct credentials\n   • Database '%s' exists", cfg.name)
        except Exception:
            LOGGER.info("💡 Make sure: \n   • PostgreSQL is running\n   • config.env has correct credentials")
        return False


def check_data_availability() -> bool:
    """Check if sufficient recent data is available for analytics."""
    LOGGER.info("📊 Checking data availability...")
    try:
        from enhanced_analytics_engine import execute_query

        # table, min_records, date_column, window_days
        tables_to_check = [
            ("garmin_daily_summaries", 30, "day", 90),
            ("garmin_sleep_sessions", 20, "day", 90),
            ("daily_journal", 20, "day", 90),
            ("garmin_heart_rate_data", 1000, "day", 30),
            ("garmin_stress_data", 1000, "day", 30),
            ("garmin_respiratory_rate_data", 1000, "day", 30),
        ]

        sufficient = True
        for table, min_records, date_col, window in tables_to_check:
            query = (
                f"SELECT COUNT(*) as count FROM {table} "
                f"WHERE {date_col} >= CURRENT_DATE - INTERVAL '{window} days'"
            )

            try:
                result = execute_query(query, fetch_one=True)
                count = result.get("count", 0) if result else 0
                if count >= min_records:
                    LOGGER.info("   ✅ %s: %d records (last %d days)", table, count, window)
                else:
                    LOGGER.warning(
                        "   ⚠️  %s: %d records in last %d days (minimum %d recommended)",
                        table,
                        count,
                        window,
                        min_records,
                    )
                    if count < max(min_records // 2, 1):
                        sufficient = False
            except Exception as exc:
                LOGGER.error("   ❌ %s: Error checking data - %s", table, exc)

        if sufficient:
            LOGGER.info("✅ Sufficient data available for analytics")
        else:
            LOGGER.warning("⚠️  Limited data available - some analytics may be reduced")
        return True
    except Exception as exc:  # pragma: no cover
        LOGGER.error("❌ Data availability check failed: %s", exc)
        return False


def test_analytics_modules() -> bool:
    """Ensure core analytics modules import and instantiate."""
    LOGGER.info("🧠 Testing analytics modules...")
    modules = [
        ("enhanced_analytics_engine", "EnhancedHealthAnalytics"),
        ("specialized_analytics", "SleepAnalytics"),
        ("specialized_analytics", "StressAnalytics"),
        ("specialized_analytics", "ActivityAnalytics"),
        ("predictive_analytics", "PredictiveHealthAnalytics"),
    ]

    for module_name, class_name in modules:
        try:
            module = importlib.import_module(module_name)
            analytics_class = getattr(module, class_name)
            _ = analytics_class()
            LOGGER.info("   ✅ %s", class_name)
        except Exception as exc:
            LOGGER.error("   ❌ %s: %s", class_name, exc)
            return False

    LOGGER.info("✅ All analytics modules working")
    return True


def start_enhanced_backend(port: int = 5002, debug: bool = True) -> bool:
    """Start the enhanced backend server."""
    LOGGER.info("🚀 Starting Enhanced Analytics Backend on port %d (debug=%s)...", port, debug)
    try:
        from backend_api_enhanced import app

        LOGGER.info("📊 Capabilities:\n   • Advanced correlations\n   • Clustering\n   • Temporal patterns\n   • Recovery analysis\n   • Specialized sleep/stress/activity\n   • Predictive analytics\n   • Personalized insights\n   • Period comparisons")
        LOGGER.info("🌐 Server: http://localhost:%d", port)
        LOGGER.info("📚 API doc: /api/analytics/info | 🏥 Health: /api/health")

        app.run(debug=debug, host="0.0.0.0", port=port)
        return True
    except KeyboardInterrupt:  # pragma: no cover
        LOGGER.info("👋 Enhanced backend stopped by user")
        return False
    except Exception as exc:  # pragma: no cover
        LOGGER.exception("❌ Failed to start enhanced backend: %s", exc)
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start Enhanced Backend API")
    parser.add_argument("--port", type=int, default=5002, help="HTTP port (default: 5002)")
    parser.add_argument("--debug", action="store_true", help="Enable Flask debug")
    parser.add_argument("--verbose", action="store_true", help="Verbose logging")
    parser.add_argument("--no-install", action="store_true", help="Skip auto-install of missing deps")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(verbose=args.verbose)

    LOGGER.info("🚀 Enhanced Analytics Backend Startup")
    load_env("config.env")

    if not check_dependencies(auto_install=not args.no_install):
        sys.exit(1)
    if not check_database_connection():
        sys.exit(1)
    if not check_data_availability():
        sys.exit(1)
    if not test_analytics_modules():
        sys.exit(1)

    LOGGER.info("✅ All startup checks passed! ✨")
    time.sleep(1)
    start_enhanced_backend(port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
