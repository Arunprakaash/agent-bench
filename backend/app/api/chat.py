import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.runner import executor
from app.schemas.chat import ChatMessage, ChatTurnRequest, ChatTurnResponse

router = APIRouter()


@router.post("/turn", response_model=ChatTurnResponse)
async def chat_turn(data: ChatTurnRequest, db: AsyncSession = Depends(get_db)):
    """
    Stateless chat turn runner.

    We re-create an AgentSession per request, but seed it with the provided history so the
    agent behaves consistently turn-to-turn. The client owns the transcript.
    """
    module = data.agent_module
    cls_name = data.agent_class
    llm_model = data.llm_model
    agent_kwargs = data.agent_args or {}

    if data.agent_id:
        res = await db.execute(select(Agent).where(Agent.id == data.agent_id))
        agent = res.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=400, detail="agent_id not found")
        module = agent.module
        cls_name = agent.agent_class
        llm_model = agent.default_llm_model
        if not data.agent_args and agent.default_agent_args:
            agent_kwargs = agent.default_agent_args

    try:
        agent_cls = executor._load_agent_class(module, cls_name)  # noqa: SLF001
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    from livekit.agents import AgentSession, ChatContext
    from livekit.plugins import openai

    turn_start = time.monotonic()
    async with (
        openai.responses.LLM(model=llm_model, use_websocket=False) as llm,
        AgentSession(llm=llm) as session,
    ):
        agent = agent_cls(**agent_kwargs)
        await session.start(agent)

        if data.history:
            chat_ctx = ChatContext()
            for msg in data.history:
                chat_ctx.add_message(role=msg.role, content=msg.content)
            await agent.update_chat_ctx(chat_ctx)

        if data.mock_tools:
            from livekit.agents import mock_tools

            mock_fns = executor._build_mock_fns(data.mock_tools)  # noqa: SLF001
            with mock_tools(agent_cls, mock_fns):
                run_result = await session.run(user_input=data.user_input)
        else:
            run_result = await session.run(user_input=data.user_input)

    events = executor._extract_events(run_result)  # noqa: SLF001
    assistant_msgs = [
        e.get("content", "")
        for e in events
        if e.get("type") == "message" and e.get("role") == "assistant"
    ]
    assistant_message = (assistant_msgs[-1] if assistant_msgs else "").strip()
    if not assistant_message:
        # Fallback: show at least *something* in the UI if the agent only tool-called.
        assistant_message = "(no assistant message)"

    _ = (time.monotonic() - turn_start) * 1000

    next_history = [
        *data.history,
        ChatMessage(role="user", content=data.user_input),
        ChatMessage(role="assistant", content=assistant_message),
    ]
    return ChatTurnResponse(assistant_message=assistant_message, events=events, history=next_history)
