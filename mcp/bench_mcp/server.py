"""Bench MCP server — exposes Bench as MCP tools for Claude Desktop and other MCP clients."""

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BENCH_API_URL = os.environ.get("BENCH_API_URL", "http://localhost:8000").rstrip("/")
BENCH_API_TOKEN = os.environ.get("BENCH_API_TOKEN", "")

mcp = FastMCP("Bench")


def _client() -> httpx.Client:
    if not BENCH_API_TOKEN:
        raise RuntimeError("BENCH_API_TOKEN environment variable is not set.")
    return httpx.Client(
        base_url=BENCH_API_URL,
        headers={"Authorization": f"Bearer {BENCH_API_TOKEN}"},
        timeout=120,
    )


def _get(path: str, params: dict | None = None) -> Any:
    with _client() as client:
        r = client.get(path, params={k: v for k, v in (params or {}).items() if v is not None})
        r.raise_for_status()
        return r.json()


def _post(path: str, body: dict) -> Any:
    with _client() as client:
        r = client.post(path, json={k: v for k, v in body.items() if v is not None})
        r.raise_for_status()
        return r.json()


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool()
def list_workspaces() -> list[dict]:
    """List all workspaces you belong to."""
    return _get("/api/workspaces")


@mcp.tool()
def list_agents(workspace_id: str | None = None) -> list[dict]:
    """List agents, optionally filtered to a specific workspace."""
    return _get("/api/agents", {"workspace_id": workspace_id})


@mcp.tool()
def list_scenarios(workspace_id: str | None = None) -> list[dict]:
    """List scenarios, optionally filtered to a specific workspace."""
    return _get("/api/scenarios", {"workspace_id": workspace_id})


@mcp.tool()
def list_suites(workspace_id: str | None = None) -> list[dict]:
    """List test suites, optionally filtered to a specific workspace."""
    return _get("/api/suites", {"workspace_id": workspace_id})


@mcp.tool()
def run_scenario(scenario_id: str, agent_args: dict | None = None) -> dict:
    """Run a single scenario synchronously and return the full result.

    The agent is already attached to the scenario — no need to specify one.
    agent_args can override runtime arguments for the agent (e.g. environment targeting).
    """
    return _post("/api/runs", {"scenario_id": scenario_id, "agent_args": agent_args})


@mcp.tool()
def run_suite(suite_id: str, agent_args: dict | None = None) -> list[dict]:
    """Trigger a suite run (all scenarios in the suite run in parallel).

    Returns immediately with run stubs in PENDING status.
    Use get_run(run_id) to poll individual run results, or list_runs(suite_id=...) to see all.
    """
    return _post("/api/runs/suite", {"suite_id": suite_id, "agent_args": agent_args})


@mcp.tool()
def get_run(run_id: str) -> dict:
    """Get the full result of a run, including per-turn verdicts.

    Useful for polling suite runs (status: pending → running → passed/failed/error).
    """
    return _get(f"/api/runs/{run_id}")


@mcp.tool()
def list_runs(
    workspace_id: str | None = None,
    scenario_id: str | None = None,
    suite_id: str | None = None,
    agent_id: str | None = None,
    status: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """List recent runs with optional filters.

    status can be: pending, running, passed, failed, error
    """
    return _get(
        "/api/runs",
        {
            "workspace_id": workspace_id,
            "scenario_id": scenario_id,
            "suite_id": suite_id,
            "agent_id": agent_id,
            "status": status,
            "limit": limit,
        },
    )


@mcp.tool()
def list_failures(
    workspace_id: str | None = None,
    scenario_id: str | None = None,
    suite_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """List failed and errored runs (the failures inbox)."""
    return _get(
        "/api/failures",
        {
            "workspace_id": workspace_id,
            "scenario_id": scenario_id,
            "suite_id": suite_id,
            "agent_id": agent_id,
            "limit": limit,
        },
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    mcp.run()


if __name__ == "__main__":
    main()
