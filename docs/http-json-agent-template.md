# HTTP JSON Agent Template

Use this when creating an agent with `provider_type: "http_json"`.

## Create Agent Payload

```json
{
  "name": "Remote HTTP Agent",
  "description": "Calls external HTTP endpoint for each turn",
  "module": "remote.http",
  "agent_class": "HttpJsonAgent",
  "provider_type": "http_json",
  "connection_config": {
    "endpoint": "https://example.com/agent/run",
    "method": "POST",
    "timeout_ms": 30000,
    "headers": {
      "Authorization": "Bearer REPLACE_ME",
      "X-Tenant": "bench"
    },
    "payload": {
      "app": "bench"
    },
    "events_path": "events",
    "test_endpoint": "https://example.com/health",
    "test_method": "GET"
  },
  "default_llm_model": "gpt-4o-mini",
  "default_judge_model": "gpt-4o-mini",
  "default_agent_args": {
    "mode": "prod"
  },
  "tags": ["remote", "http"]
}
```

## Expected Remote Response

Recommended shape:

```json
{
  "events": [
    { "type": "message", "role": "assistant", "content": "Hello, how can I help?" },
    { "type": "function_call", "name": "lookup_order", "arguments": { "order_id": "A-123" } },
    { "type": "function_call_output", "output": { "status": "shipped" }, "is_error": false }
  ]
}
```

Supported fallback shape:

```json
{
  "text": "Hello, how can I help?"
}
```

## Turn Request Sent By Bench

For each turn, Bench sends:

```json
{
  "user_input": "Hi",
  "chat_history": [],
  "llm_model": "gpt-4o-mini",
  "judge_model": "gpt-4o-mini",
  "agent_args": {},
  "mock_tools": null
}
```

## One-Command Smoke Test

Use the helper script to create an `http_json` agent and call connection-test:

```bash
cd backend
API_BASE=http://localhost:8000/api \
API_TOKEN=<your_bench_bearer_token> \
python scripts/smoke_http_json_agent.py \
  --endpoint https://example.com/agent/run \
  --test-endpoint https://example.com/health
```
