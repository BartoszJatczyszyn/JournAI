start_fresh_docker.sh — usage

This helper script tears down existing docker-compose services, removes the Postgres volume, runs the project's migrations inside the backend container, and starts the backend plus a simple nginx container to serve the frontend static files.

How to use (macOS / zsh):

1. Make sure Docker Desktop and `docker compose` are installed and running.
2. From the repository root run:

```bash
./start_fresh_docker.sh
```

3. The script will prompt for confirmation before destructive steps.

Notes:
- The script uses `docker compose` (Compose V2). If you only have `docker-compose`, adapt commands accordingly.
- The script may start a temporary nginx container that serves the contents of `Diary-AI-FE/build` or `Diary-AI-FE` on port 8080 (check the script for exact behavior).
- The migration command executed in the backend is `python run_migration.py`, which relies on the backend image including the migration scripts (this is wired in `Diary-AI-BE/Dockerfile`).

Running frontend locally while backend runs in Docker

If you prefer running the frontend separately (recommended during development), do the following in a new terminal window:

```bash
# install and start frontend (React dev server)
cd Diary-AI-FE/frontend-react
npm install
npm start
```

The React dev server runs on http://localhost:3000 and is configured to proxy API calls to http://localhost:5002 so it will talk to the backend running inside Docker.

```
