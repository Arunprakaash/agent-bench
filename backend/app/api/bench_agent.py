"""Bench AI — an OpenAI agent that helps users create test scenarios and suites."""

import json
import os
from dataclasses import dataclass
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agents import Agent, Runner, RunContextWrapper, function_tool

from app.api.access import get_user_workspace_ids, ownership_filter
from app.api.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.agent import Agent as AgentModel
from app.models.scenario import Scenario
from app.models.suite import Suite
from app.models.user import User
from app.schemas.chat import ChatMessage, ChatTurnRequest
from app.schemas.scenario import ExpectationBase, ScenarioCreate, TurnBase
from app.schemas.suite import SuiteCreate

router = APIRouter()


# ─── Tool parameter models ─────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    content: str


class TurnExpectation(BaseModel):
    type: str
    intent: str | None = None


class TurnInput(BaseModel):
    user_input: str
    expectations: list[TurnExpectation]


class ElicitationField(BaseModel):
    name: str
    label: str
    type: str  # "string" | "number" | "boolean" | "select" | "email" | "textarea"
    description: str | None = None
    options: list[str] | None = None  # for select type
    required: bool = True
    placeholder: str | None = None


# ─── Context ──────────────────────────────────────────────────────────────────

@dataclass
class BenchContext:
    user: User
    db: AsyncSession
    workspace_id: UUID | None


# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Bench AI — a conversational assistant built into the Bench testing platform. \
You help engineering teams write test scenarios and suites for their AI agents.

Your workflow:
1. Ask the user which agent they want to test, or call list_agents to show what's available.
2. Understand the agent's purpose from the user.
3. Probe the agent using probe_agent — send it realistic messages and observe how it responds.
4. Based on what you learn, propose test scenarios covering happy paths, edge cases, and failure modes.
5. Confirm the scenario names and expectations with the user, then create them with create_scenario.
6. Optionally group related scenarios into a suite with create_suite.

Guidelines for great scenarios:
- Each scenario tests ONE specific flow or behavior.
- Expectations use `intent`: plain English describing what the agent SHOULD do \
(e.g. "Agent asks for the user's travel dates"). The LLM judge evaluates intent — not exact strings.
- Use expectation type "message" for conversational turns.
- Probe the agent several times before writing expectations so you understand its real behavior.
- Always confirm with the user before creating anything.

Using elicitation:
- When you need specific structured details from the user (agent purpose, test parameters, persona details), \
call elicitate to show them an inline form instead of asking in plain text.
- Use elicitation for initial information gathering (e.g., agent name, type, target behaviors).
- Keep forms short — 2–4 fields maximum. Ask for more in follow-up elicitations if needed."""


# ─── Tools ────────────────────────────────────────────────────────────────────

@function_tool
async def list_agents(wrapper: RunContextWrapper[BenchContext]) -> str:
    """List all AI agents registered in the current workspace."""
    ctx = wrapper.context
    wids = await get_user_workspace_ids(ctx.user.id, ctx.db)
    q = select(AgentModel).where(ownership_filter(AgentModel, ctx.user.id, wids))
    if ctx.workspace_id:
        q = q.where(AgentModel.workspace_id == ctx.workspace_id)
    result = await ctx.db.execute(q)
    agents = result.scalars().all()
    if not agents:
        return "No agents found in this workspace."
    return json.dumps([
        {"id": str(a.id), "name": a.name, "description": a.description, "provider_type": a.provider_type}
        for a in agents
    ])


@function_tool
async def get_agent(wrapper: RunContextWrapper[BenchContext], agent_id: str) -> str:
    """Get details of a specific agent.

    Args:
        agent_id: UUID of the agent.
    """
    ctx = wrapper.context
    wids = await get_user_workspace_ids(ctx.user.id, ctx.db)
    result = await ctx.db.execute(
        select(AgentModel).where(
            AgentModel.id == UUID(agent_id),
            ownership_filter(AgentModel, ctx.user.id, wids),
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        return "Agent not found."
    return json.dumps({
        "id": str(agent.id),
        "name": agent.name,
        "description": agent.description,
        "provider_type": agent.provider_type,
        "default_llm_model": agent.default_llm_model,
    })


@function_tool
async def probe_agent(
    wrapper: RunContextWrapper[BenchContext],
    agent_id: str,
    message: str,
    history: list[HistoryMessage] | None = None,
) -> str:
    """Send a message to an agent and get its response. Use this to observe how the agent behaves.

    Args:
        agent_id: UUID of the agent to probe.
        message: The user message to send.
        history: Optional previous conversation as list of {role, content} messages.
    """
    from app.api.chat import chat_turn

    ctx = wrapper.context
    history_msgs = [ChatMessage(role=m.role, content=m.content) for m in (history or [])]
    req = ChatTurnRequest(
        agent_id=UUID(agent_id),
        agent_module="",
        agent_class="",
        user_input=message,
        history=history_msgs,
    )
    try:
        response = await chat_turn(req, ctx.db)
        return json.dumps({
            "assistant_message": response.assistant_message,
            "history": [{"role": m.role, "content": m.content} for m in response.history],
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@function_tool
async def list_scenarios(wrapper: RunContextWrapper[BenchContext]) -> str:
    """List existing test scenarios in the current workspace."""
    ctx = wrapper.context
    wids = await get_user_workspace_ids(ctx.user.id, ctx.db)
    q = (
        select(Scenario)
        .options(selectinload(Scenario.turns))
        .where(ownership_filter(Scenario, ctx.user.id, wids))
        .order_by(Scenario.updated_at.desc())
    )
    if ctx.workspace_id:
        q = q.where(Scenario.workspace_id == ctx.workspace_id)
    result = await ctx.db.execute(q)
    scenarios = result.scalars().all()
    if not scenarios:
        return "No scenarios found."
    return json.dumps([
        {"id": str(s.id), "name": s.name, "description": s.description, "turn_count": len(s.turns)}
        for s in scenarios
    ])


@function_tool
async def create_scenario(
    wrapper: RunContextWrapper[BenchContext],
    name: str,
    agent_id: str,
    turns: list[TurnInput],
    description: str | None = None,
) -> str:
    """Create a test scenario in Bench.

    Args:
        name: Scenario name.
        agent_id: UUID of the agent to test.
        turns: List of turns, each with user_input and expectations.
        description: Optional description.
    """
    from app.api.scenarios import create_scenario as _create

    ctx = wrapper.context
    turn_objs = [
        TurnBase(
            user_input=t.user_input,
            expectations=[
                ExpectationBase(type=e.type, intent=e.intent)
                for e in t.expectations
            ],
        )
        for t in turns
    ]
    data = ScenarioCreate(
        name=name,
        description=description,
        agent_id=UUID(agent_id),
        workspace_id=ctx.workspace_id,
        turns=turn_objs,
    )
    try:
        scenario = await _create(data, ctx.user, ctx.db)
        return json.dumps({"id": str(scenario.id), "name": scenario.name, "turn_count": len(scenario.turns)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@function_tool
async def list_suites(wrapper: RunContextWrapper[BenchContext]) -> str:
    """List existing test suites in the current workspace."""
    ctx = wrapper.context
    wids = await get_user_workspace_ids(ctx.user.id, ctx.db)
    q = select(Suite).where(ownership_filter(Suite, ctx.user.id, wids))
    if ctx.workspace_id:
        q = q.where(Suite.workspace_id == ctx.workspace_id)
    result = await ctx.db.execute(q)
    suites = result.scalars().all()
    if not suites:
        return "No suites found."
    return json.dumps([
        {"id": str(s.id), "name": s.name, "description": s.description}
        for s in suites
    ])


@function_tool
async def create_suite(
    wrapper: RunContextWrapper[BenchContext],
    name: str,
    scenario_ids: list[str],
    description: str | None = None,
) -> str:
    """Create a test suite grouping multiple scenarios together.

    Args:
        name: Suite name.
        scenario_ids: List of scenario UUIDs to include.
        description: Optional description.
    """
    from app.api.suites import create_suite as _create

    ctx = wrapper.context
    data = SuiteCreate(
        name=name,
        description=description,
        scenario_ids=[UUID(s) for s in scenario_ids],
        workspace_id=ctx.workspace_id,
    )
    try:
        suite = await _create(data, ctx.user, ctx.db)
        return json.dumps({"id": str(suite.id), "name": suite.name})
    except Exception as e:
        return json.dumps({"error": str(e)})


@function_tool
async def elicitate(
    wrapper: RunContextWrapper[BenchContext],
    message: str,
    fields: list[ElicitationField],
) -> str:
    """Request structured information from the user through an inline form in the chat UI.
    Use this instead of asking questions in plain text when you need specific structured details.
    The conversation pauses until the user submits the form.

    Args:
        message: Clear explanation of what information you need and why.
        fields: Form fields to collect. Each needs: name (snake_case identifier),
            label (human-readable), type (string/number/boolean/select/email/textarea).
            For select type, include options. For string/email/textarea, include placeholder.
    """
    return json.dumps({
        "_elicitation": True,
        "message": message,
        "fields": [f.model_dump() for f in fields],
    })


# ─── Agent definition ─────────────────────────────────────────────────────────

_bench_agent = Agent(
    name="Bench AI",
    model="gpt-4o",
    instructions=SYSTEM_PROMPT,
    tools=[list_agents, get_agent, probe_agent, list_scenarios, create_scenario, list_suites, create_suite, elicitate],
)


# ─── SSE stream ───────────────────────────────────────────────────────────────

_TOOL_LABELS: dict[str, str] = {
    "list_agents": "Listing agents…",
    "get_agent": "Getting agent details…",
    "probe_agent": "Calling agent…",
    "list_scenarios": "Listing scenarios…",
    "create_scenario": "Creating scenario…",
    "list_suites": "Listing suites…",
    "create_suite": "Creating suite…",
    "elicitate": "Requesting information…",
}


async def _stream(messages: list[dict], workspace_id: str | None, user: User, db: AsyncSession):
    # Ensure the OpenAI key is available to the agents runtime.
    if settings.openai_api_key and not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings.openai_api_key

    context = BenchContext(
        user=user,
        db=db,
        workspace_id=UUID(workspace_id) if workspace_id else None,
    )

    try:
        result = Runner.run_streamed(_bench_agent, messages, context=context)

        async for event in result.stream_events():
            if event.type == "raw_response_event":
                from openai.types.responses import ResponseTextDeltaEvent
                if isinstance(event.data, ResponseTextDeltaEvent):
                    yield f"data: {json.dumps({'type': 'delta', 'text': event.data.delta})}\n\n"

            elif event.type == "run_item_stream_event":
                item = event.item
                if item.type == "tool_call_item":
                    raw = getattr(item, "raw_item", None)
                    tool_name = getattr(raw, "name", "") if raw else ""
                    label = _TOOL_LABELS.get(tool_name, f"Running {tool_name}…")
                    raw_args = getattr(raw, "arguments", None) if raw else None
                    try:
                        tool_input = json.loads(raw_args) if raw_args else {}
                    except Exception:
                        tool_input = {"raw": str(raw_args)} if raw_args else {}
                    yield f"data: {json.dumps({'type': 'tool_start', 'name': tool_name, 'label': label, 'input': tool_input})}\n\n"

                elif item.type == "tool_call_output_item":
                    output = getattr(item, "output", "{}")
                    try:
                        parsed = json.loads(output)
                    except Exception:
                        parsed = {"raw": str(output)}
                    if isinstance(parsed, dict) and parsed.get("_elicitation"):
                        yield f"data: {json.dumps({'type': 'elicitation', 'message': parsed.get('message', ''), 'fields': parsed.get('fields', [])})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'tool_done', 'result': parsed})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ─── Endpoint ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]
    workspace_id: str | None = None


@router.post("/chat")
async def bench_agent_chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return StreamingResponse(
        _stream(data.messages, data.workspace_id, current_user, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
