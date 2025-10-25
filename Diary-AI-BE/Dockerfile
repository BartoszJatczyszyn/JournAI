# Backend Dockerfile for Diary-AI-BE
# Multi-stage build (slim final image)

FROM python:3.13.5-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=/app \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# System deps (add compilers/libs needed to build numpy/scipy and psycopg when wheels are not available)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    git \
    gfortran \
    pkg-config \
    libopenblas-dev \
    liblapack-dev \
    libblas-dev \
    libpq-dev \
    python3-dev \
    ninja-build && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements & install early for caching
COPY Diary-AI-BE/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend code (app package)
COPY Diary-AI-BE/app ./app
COPY Diary-AI-BE/run_migration.py ./run_migration.py
COPY Diary-AI-BE/config.env.example ./config.env.example
# Drop heavy model artifacts from image (mounted as volume at runtime)
RUN rm -rf ./app/analytics/models/* || true

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PORT=5002 \
    HOST=0.0.0.0 \
    APP_MODULE=app.backend_api_enhanced:app \
    PYTHONPATH=/app/app \
    WORKERS=2

EXPOSE 5002

# Entry: start uvicorn FastAPI server with configurable workers (default 2)
ENTRYPOINT ["sh", "-c", "uvicorn app.backend_api_enhanced:app --host 0.0.0.0 --port ${PORT:-5002} --workers ${WORKERS:-2}"]
