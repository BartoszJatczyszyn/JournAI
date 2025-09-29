start_fresh_docker.sh — usage

This helper script tears down existing docker-compose services, removes the Postgres volume, runs the project's migrations inside the backend container, and starts the backend plus a simple nginx container to serve the frontend static files.

How to use:

1. Make sure Docker and docker compose are installed and running.
2. From the repository root run:

   ./start_fresh_docker.sh

3. The script will prompt for confirmation before destructive steps.

Notes:
- The script uses `docker compose` (Compose V2). If you only have `docker-compose`, adapt commands accordingly.
- The frontend is served via a temporary nginx container on port 8080 mapping `Diary-AI-FE` directory. Adjust as needed.
- The migration command executed in the backend is `python run_migration.py`, which relies on the backend image including the migration scripts (this is wired in `Diary-AI-BE/Dockerfile`).
