"""Agent registration with the Bench server."""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def upsert_agent(
    bench_url: str,
    bench_token: str,
    name: str,
    endpoint: str,
    request_template: dict[str, Any],
    timeout_ms: int = 30000,
) -> str:
    """Create or update an agent in Bench. Returns the agent_id.

    Steps:
    1. GET /api/agents — find existing agent by name.
    2. If found: PUT /api/agents/{id} to update.
    3. If not found: POST /api/agents to create.
    """
    headers = {
        "Authorization": f"Bearer {bench_token}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "name": name,
        "module": "bench_sdk",
        "agent_class": "sdk_agent",
        "provider_type": "rest_api",
        "connection_config": {
            "endpoint": endpoint,
            "timeout_ms": timeout_ms,
            "request_template": request_template,
        },
    }

    timeout = timeout_ms / 1000

    async with httpx.AsyncClient(base_url=bench_url, timeout=timeout, headers=headers) as client:
        # Look for existing agent
        resp = await client.get("/api/agents")
        resp.raise_for_status()
        agents: list[dict[str, Any]] = resp.json() if isinstance(resp.json(), list) else resp.json().get("agents", [])

        existing_id: str | None = None
        for agent in agents:
            if isinstance(agent, dict) and agent.get("name") == name:
                existing_id = str(agent["id"])
                break

        if existing_id:
            put_resp = await client.put(f"/api/agents/{existing_id}", json=payload)
            put_resp.raise_for_status()
            return existing_id
        else:
            post_resp = await client.post("/api/agents", json=payload)
            post_resp.raise_for_status()
            data = post_resp.json()
            return str(data.get("id", ""))
