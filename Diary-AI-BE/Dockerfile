# Backend Dockerfile for Diary-AI-BE
# Multi-stage build (slim final image)

FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=/app \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# System deps (psycopg binary should work without libpq, but add basics)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements & install early for caching
COPY Diary-AI-BE/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend scripts
COPY Diary-AI-BE/scripts ./scripts
COPY Diary-AI-BE/backend_api_enhanced.py ./backend_api_enhanced.py
COPY Diary-AI-BE/run_migration.py ./run_migration.py
COPY Diary-AI-BE/config.env.example ./config.env.example
# Drop heavy model artifacts from image (mounted as volume at runtime)
RUN rm -rf ./scripts/analytics/models/* || true

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PORT=5002 \
    HOST=0.0.0.0 \
    FLASK_ENV=production \
    PYTHONPATH=/app/scripts

EXPOSE 5002

# Entry: run module directly (no need to copy the script to root)
ENTRYPOINT ["python", "-m", "scripts.start_enhanced_backend"]
