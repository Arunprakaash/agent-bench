"""Dev-only endpoints (e.g. reset DB for local/testing)."""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.database import engine

router = APIRouter()


@router.post("/reset", status_code=204)
async def reset_database(confirm: str = Query(..., description="Set to 'yes' to confirm wipe")):
    """Wipe all test data: turn_results, test_runs, suite_scenarios, scenario_revisions, scenario_turns, scenarios, suites, agents. Order respects FKs."""
    if confirm != "yes":
        raise HTTPException(status_code=400, detail="Set confirm=yes to confirm database reset")
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM turn_results"))
        await conn.execute(text("DELETE FROM test_runs"))
        await conn.execute(text("DELETE FROM suite_scenarios"))
        await conn.execute(text("DELETE FROM scenario_revisions"))
        await conn.execute(text("DELETE FROM scenario_turns"))
        await conn.execute(text("DELETE FROM scenarios"))
        await conn.execute(text("DELETE FROM suites"))
        await conn.execute(text("DELETE FROM agents"))
        await conn.execute(text("DELETE FROM workspace_members"))
        await conn.execute(text("DELETE FROM oauth_identities"))
        await conn.execute(text("DELETE FROM workspaces"))
        await conn.execute(text("DELETE FROM users"))
