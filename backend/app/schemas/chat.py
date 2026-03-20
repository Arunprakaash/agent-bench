from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="user|assistant|system")
    content: str


class ChatTurnRequest(BaseModel):
    agent_id: UUID | None = None
    agent_module: str
    agent_class: str
    llm_model: str = "gpt-4o-mini"
    agent_args: dict | None = None
    mock_tools: dict | None = None
    history: list[ChatMessage] = Field(default_factory=list)
    user_input: str


class ChatTurnResponse(BaseModel):
    assistant_message: str
    events: list[dict] = Field(default_factory=list)
    history: list[ChatMessage] = Field(default_factory=list)
