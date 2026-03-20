# AgentBench

A visual testing and evaluation platform for voice agents (based on LiveKit's agent testing framework).
Create multi-turn scenarios, run them against your agent, and review turn-by-turn events + judge verdicts in real time.

## Features

- Scenario editor (multi-turn test flows)
- Expectation/assertion builder (messages, tool calls, handoffs, etc.)
- Test runner (execute scenarios and inspect results)
- Run history + failures inbox
- Suite management (group scenarios into suites)
- Side-by-side diff for runs
- API-first workflows (Postman collection included)

## Quick Start (Docker)

1. Start the stack:

```bash
docker compose up -d --build
```

2. (Recommended) Seed demo data (this wipes and re-creates test data):

```bash
docker compose exec backend python scripts/reset_and_seed.py
```

3. Open the UI:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/api/health
- Backend API docs (Swagger): http://localhost:8000/api/docs

## Environment

The backend uses `backend/.env` (loaded by `docker-compose.yml`).

Common variables:

- `OPENAI_API_KEY`: used by the judge/evaluation flow (if unset, judge steps may fail)
- `JWT_SECRET`: for auth tokens
- `CORS_ORIGINS`: controls allowed origins

## API / Postman

Postman collection:

- `backend/postman/AgentBench-API.postman_collection.json`

You can browse the API schema in the backend Swagger UI:

- `/api/docs`

For full docs, see `docs/`.

## Notes

- The backend performs lightweight schema initialization at startup (so you can typically iterate without manual migrations).
- All UI state changes are driven by the backend REST APIs; real-time execution updates are streamed over Socket.IO.

