# Bench

Agent testing platform. Define multi-turn conversation scenarios, run them against your agent, and get turn-by-turn pass/fail results with LLM-based evaluation.

**[Docs →](https://bech.mintlify.app)**

---

## What it does

- **Multi-turn scenarios** — define user inputs and expectations (messages, tool calls, handoffs) per turn
- **LLM evaluation** — intent-based assertions judged by an LLM, not brittle string matching
- **Version history** — every scenario save is versioned; restore any previous version
- **Suites** — group scenarios and run them in parallel
- **Scheduled runs** — trigger regression suites on a recurring schedule
- **Failures inbox** — triage failed runs with the first failing turn surfaced
- **Regression alerts** — get notified when a previously passing scenario starts failing
- **Python SDK** — wrap your existing agent endpoint with one decorator; auto-registers with Bench
- **`agent_args`** — per-run overrides (tenant, environment, locale) without editing scenarios
- **CLI** — run scenarios and suites from the terminal or CI pipelines
- **CI integration** — API tokens, non-zero exit codes, `--agent-args` flag for environment targeting

---

## Quick start

```bash
# Start the stack
docker compose up -d --build

# Seed demo data (optional)
docker compose exec backend python scripts/reset_and_seed.py
```

| Service | URL |
|---|---|
| UI | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/api/docs |

Add your OpenAI key to `backend/.env`:

```env
OPENAI_API_KEY=sk-...
```

---

## Connecting your agent

### SDK (recommended)

Install the SDK and add one decorator to your existing endpoint. Bench auto-registers the agent and handles all field mapping.

```bash
pip install bench-sdk
```

```python
# FastAPI example
from bench_sdk import bench_agent

@app.post("/chat")
@bench_agent(
    bench_url="https://your-bench.example.com",
    bench_token="ab_xxx",
    name="booking-agent",
)
async def chat(query: str, session_id: str) -> dict:
    result = await my_agent.run(query)
    return {"reply": result}
```

The decorator:
- Reads your function signature and builds a `request_template` automatically
- Only activates when Bench sends `X-Bench-Run: true` — normal traffic is unaffected
- Registers (or updates) the agent in Bench on startup

### `agent_args` — per-run params

Pass enterprise-specific params (tenant, environment, session) per scenario or at run time — no hardcoding in agent config.

```bash
# CLI
bench run --scenario booking-flow --agent-args '{"tenant_id":"acme-staging","environment":"staging"}'

# API
POST /api/runs
{ "scenario_id": "...", "agent_args": { "tenant_id": "acme-staging" } }
```

### Manual HTTP

If you prefer no SDK, create an agent with `Connector Type: REST API` and configure a `request_template`:

```json
{
  "url": "https://your-agent.example.com/chat",
  "request_template": {
    "query": "{{user_input}}",
    "tenant_id": "{{tenant_id}}",
    "history": "{{chat_history}}"
  }
}
```

Full guide → [Connecting Agents](https://bech.mintlify.app/docs/guides/connecting-agents)

---

## CLI

```bash
pip install -e cli/

bench login --email you@example.com
bench run --scenario booking-flow
bench suites run regression-suite --agent-args '{"environment":"staging"}'
```

---

## Docs

[https://bech.mintlify.app](https://bech.mintlify.app)
