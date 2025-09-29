#!/usr/bin/env bash
# start_fresh_docker.sh
# Safely tear down docker compose services, remove DB volume, run migrations and start backend + frontend in Docker.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Cannot find docker-compose.yml at $COMPOSE_FILE"
  exit 1
fi

echo "This script will:"
echo "  - stop and remove compose containers"
echo "  - remove postgres volume 'pg_data'"
echo "  - bring up the database, wait for readiness"
echo "  - build backend image, run migrations inside backend container"
echo "  - start backend (detached) and serve frontend via temporary nginx container"

read -r -p "Proceed? [y/N]: " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted by user"
  exit 0
fi

echo "Stopping and removing compose containers..."
docker compose down --volumes --remove-orphans

echo "Removing named Docker volume 'pg_data' if present..."
if docker volume inspect journal_ai_pg_data >/dev/null 2>&1; then
  docker volume rm journal_ai_pg_data || true
fi
# also try the volume name as defined in compose (pg_data)
if docker volume inspect pg_data >/dev/null 2>&1; then
  docker volume rm pg_data || true
fi

echo "Bringing up database only to initialize volume and allow migrations to run..."
docker compose up -d db

echo "Waiting for Postgres to be ready (up to 120s)..."
for i in {1..24}; do
  if docker compose exec -T db pg_isready -U "${DB_USER:-diary_user}" >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  echo -n '.'
  sleep 5
done

echo
echo "Building backend image..."
docker compose build backend

echo "Running migration inside backend container (this will run run_migration.py)..."
# Use `run` to execute the migration in a temporary container so that ENTRYPOINT doesn't interfere.
docker compose run --rm -T backend python run_migration.py || {
  echo "Migration failed. Check logs or run: docker compose run --rm backend python run_migration.py" >&2
  exit 1
}

echo "Starting backend in detached mode..."
docker compose up -d backend

echo "Starting frontend service via docker compose..."
docker compose up -d frontend

echo "Waiting for frontend to become healthy (up to 60s)..."
for i in {1..12}; do
  status=$(docker inspect --format='{{json .State.Health.Status}}' journal_ai_frontend 2>/dev/null || echo 'null')
  if [[ "$status" == '"healthy"' ]]; then
    echo "Frontend is healthy"
    break
  fi
  echo -n '.'
  sleep 5
done

echo
echo "All done. Backend -> http://localhost:5002  Frontend -> http://localhost:8080"

echo "To follow backend logs: docker compose logs -f backend"
echo "To run migrations again: docker compose run --rm backend python run_migration.py"
