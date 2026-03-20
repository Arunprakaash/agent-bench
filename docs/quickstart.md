# Quick Start

## 1) Start services (Docker Compose)

```bash
docker compose up -d --build
```

## 2) Seed demo data (optional but recommended)

This resets the database and creates:
- a demo auth user
- an example agent
- example scenarios
- a suite containing those scenarios

```bash
docker compose exec backend python scripts/reset_and_seed.py
```

Demo login (created by the seed script):
- Email: `prakaasharun50@gmail.com`
- Password: `123456`

## 3) Use the UI

- Frontend: http://localhost:3000
- Backend Swagger: http://localhost:8000/api/docs
- Backend health: http://localhost:8000/api/health

## 4) Run a test

In the UI:

1. Go to `Scenarios`
2. Open a scenario and click `Run Test`
3. Review the run details (turn-by-turn events + pass/fail)

