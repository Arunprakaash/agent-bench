"""Bench MCP server — exposes Bench as MCP tools for Claude Desktop and other MCP clients."""

import os
import time
from typing import Any

import httpx
from mcp.server.fastmcp import Context, FastMCP

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


def _delete(path: str) -> None:
    with _client() as client:
        r = client.delete(path)
        r.raise_for_status()


def _is_terminal_status(status: str | None) -> bool:
    return status in {"passed", "failed", "error"}


async def _resolve_scenario_id(
    scenario_id: str | None,
    workspace_id: str | None,
    ctx: Context | None,
) -> str | dict | None:
    chosen_scenario_id = scenario_id
    if not chosen_scenario_id:
        if ctx is None:
            return {
                "error": "scenario_id is required when no MCP context is available for elicitation"
            }
        try:
            chosen_scenario_id = await _elicit_id(
                ctx,
                kind="scenario",
                workspace_id=workspace_id,
                list_path="/api/scenarios",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}
    return chosen_scenario_id


def _start_scenario_run_via_suite(
    scenario_id: str,
    agent_args: dict | None,
    workspace_id: str | None,
) -> dict:
    suite_name = f"tmp-scenario-run-{scenario_id[:8]}-{int(time.time())}"
    suite = _post(
        "/api/suites",
        {
            "name": suite_name,
            "description": "Temporary suite for async single-scenario run",
            "scenario_ids": [scenario_id],
            "workspace_id": workspace_id,
        },
    )
    suite_id = suite.get("id")
    runs = _post("/api/runs/suite", {"suite_id": suite_id, "agent_args": agent_args})
    run_stub = runs[0] if runs else {}
    return {
        "suite_id": suite_id,
        "run_id": run_stub.get("id"),
        "status": run_stub.get("status"),
        "scenario_id": scenario_id,
    }


async def _elicit_id(
    ctx: Context,
    *,
    kind: str,
    workspace_id: str | None,
    list_path: str,
) -> str | dict | None:
    items = _get(list_path, {"workspace_id": workspace_id})
    if not items:
        return None

    preview = "\n".join(
        f"- {it.get('name', '(unnamed)')}: {it.get('id')}" for it in items[:20]
    )
    if len(items) > 20:
        preview += f"\n...and {len(items) - 20} more."

    message = (
        f"Select a {kind} ID.\n"
        f"Available {kind}s:\n{preview}\n"
        f"Enter the exact {kind} ID."
    )

    try:
        result = await ctx.elicit(message=message, response_type=str)
    except Exception:
        return {
            "_elicitation": True,
            "message": message,
            "fields": [
                {
                    "name": f"{kind}_id",
                    "label": f"{kind.title()}",
                    "type": "select",
                    "required": True,
                    "options": [str(it.get("id")) for it in items if it.get("id")],
                }
            ],
        }

    if result.action != "accept":
        return None
    value = (result.data or "").strip()
    return value or None


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
async def get_agent(
    agent_id: str | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Get one agent by ID. If agent_id is omitted, ask the user to provide it."""
    chosen_agent_id = agent_id
    if not chosen_agent_id:
        if ctx is None:
            return {"error": "agent_id is required when no MCP context is available for elicitation"}
        try:
            chosen_agent_id = await _elicit_id(
                ctx,
                kind="agent",
                workspace_id=workspace_id,
                list_path="/api/agents",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}
        if isinstance(chosen_agent_id, dict):
            return chosen_agent_id
        if not chosen_agent_id:
            return {"status": "cancelled", "reason": "No agent selected"}

    return _get(f"/api/agents/{chosen_agent_id}")


@mcp.tool()
async def probe_agent(
    agent_id: str | None = None,
    message: str = "",
    history: list[dict] | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Send one chat turn to an agent and return assistant response plus updated history."""
    chosen_agent_id = agent_id
    if not chosen_agent_id:
        if ctx is None:
            return {"error": "agent_id is required when no MCP context is available for elicitation"}
        try:
            chosen_agent_id = await _elicit_id(
                ctx,
                kind="agent",
                workspace_id=workspace_id,
                list_path="/api/agents",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}
        if isinstance(chosen_agent_id, dict):
            return chosen_agent_id
        if not chosen_agent_id:
            return {"status": "cancelled", "reason": "No agent selected"}

    if not message.strip():
        if ctx is None:
            return {"error": "message is required"}
        try:
            result = await ctx.elicit(
                message="What message should I send to the selected agent?",
                response_type=str,
            )
        except Exception:
            return {
                "_elicitation": True,
                "message": "What message should I send to the selected agent?",
                "fields": [
                    {
                        "name": "message",
                        "label": "Message",
                        "type": "textarea",
                        "required": True,
                        "placeholder": "Type the message to send to the agent",
                    }
                ],
            }
        if result.action != "accept" or not str(result.data or "").strip():
            return {"status": "cancelled", "reason": "No probe message provided"}
        message = str(result.data).strip()

    body = {
        "agent_id": chosen_agent_id,
        "agent_module": "",
        "agent_class": "",
        "user_input": message,
        "history": history or [],
    }
    return _post("/api/chat/turn", body)


@mcp.tool()
def list_scenarios(workspace_id: str | None = None) -> list[dict]:
    """List scenarios, optionally filtered to a specific workspace."""
    return _get("/api/scenarios", {"workspace_id": workspace_id})


@mcp.tool()
async def create_scenario(
    name: str,
    turns: list[dict],
    agent_id: str | None = None,
    description: str | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Create a scenario. If agent_id is omitted, ask user to select one."""
    chosen_agent_id = agent_id
    if not chosen_agent_id:
        if ctx is None:
            return {"error": "agent_id is required when no MCP context is available for elicitation"}
        try:
            chosen_agent_id = await _elicit_id(
                ctx,
                kind="agent",
                workspace_id=workspace_id,
                list_path="/api/agents",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}
        if isinstance(chosen_agent_id, dict):
            return chosen_agent_id
        if not chosen_agent_id:
            return {"status": "cancelled", "reason": "No agent selected"}

    body = {
        "name": name,
        "description": description,
        "agent_id": chosen_agent_id,
        "workspace_id": workspace_id,
        "turns": turns,
    }
    return _post("/api/scenarios", body)


@mcp.tool()
def list_suites(workspace_id: str | None = None) -> list[dict]:
    """List test suites, optionally filtered to a specific workspace."""
    return _get("/api/suites", {"workspace_id": workspace_id})


@mcp.tool()
async def create_suite(
    name: str,
    scenario_ids: list[str] | None = None,
    description: str | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Create a suite. If scenario_ids are omitted, ask for one scenario ID to start with."""
    chosen_scenario_ids = scenario_ids or []
    if not chosen_scenario_ids:
        if ctx is None:
            return {"error": "scenario_ids is required when no MCP context is available for elicitation"}
        try:
            chosen = await _elicit_id(
                ctx,
                kind="scenario",
                workspace_id=workspace_id,
                list_path="/api/scenarios",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}
        if isinstance(chosen, dict):
            return chosen
        if not chosen:
            return {"status": "cancelled", "reason": "No scenarios selected"}
        chosen_scenario_ids = [chosen]

    body = {
        "name": name,
        "description": description,
        "scenario_ids": chosen_scenario_ids,
        "workspace_id": workspace_id,
    }
    return _post("/api/suites", body)


@mcp.tool()
async def run_scenario(
    scenario_id: str | None = None,
    agent_args: dict | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Run one scenario using async suite execution semantics.

    Returns quickly with run metadata so callers can poll with get_run/wait_for_run.
    """
    chosen_scenario_id = await _resolve_scenario_id(scenario_id, workspace_id, ctx)
    if isinstance(chosen_scenario_id, dict):
        return chosen_scenario_id
    if not chosen_scenario_id:
        return {"status": "cancelled", "reason": "No scenario selected"}
    return _start_scenario_run_via_suite(chosen_scenario_id, agent_args, workspace_id)


@mcp.tool()
async def wait_for_run(
    run_id: str,
    timeout_seconds: int = 90,
    poll_interval_seconds: int = 3,
) -> dict:
    """Poll a run until terminal status or timeout; returns latest run payload."""
    if timeout_seconds < 1:
        timeout_seconds = 1
    if poll_interval_seconds < 1:
        poll_interval_seconds = 1

    deadline = time.time() + timeout_seconds
    latest = _get(f"/api/runs/{run_id}")
    while time.time() < deadline:
        status = str(latest.get("status", "")).lower()
        if _is_terminal_status(status):
            return latest
        time.sleep(poll_interval_seconds)
        latest = _get(f"/api/runs/{run_id}")

    return {
        "status": "timeout",
        "run_id": run_id,
        "latest": latest,
        "message": "Run is still in progress. Call wait_for_run again or use get_run.",
    }


@mcp.tool()
async def run_suite(
    suite_id: str | None = None,
    agent_args: dict | None = None,
    workspace_id: str | None = None,
    ctx: Context | None = None,
) -> list[dict] | dict:
    """Trigger a suite run (all scenarios in the suite run in parallel).

    Returns immediately with run stubs in PENDING status.
    Use get_run(run_id) to poll individual run results, or list_runs(suite_id=...) to see all.
    """
    chosen_suite_id = suite_id
    if not chosen_suite_id:
        if ctx is None:
            return {
                "error": "suite_id is required when no MCP context is available for elicitation"
            }
        try:
            chosen_suite_id = await _elicit_id(
                ctx,
                kind="suite",
                workspace_id=workspace_id,
                list_path="/api/suites",
            )
        except Exception as e:
            return {"error": f"Elicitation failed: {e}"}

        if isinstance(chosen_suite_id, dict):
            return chosen_suite_id
        if not chosen_suite_id:
            return {"status": "cancelled", "reason": "No suite selected"}

    return _post("/api/runs/suite", {"suite_id": chosen_suite_id, "agent_args": agent_args})


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
