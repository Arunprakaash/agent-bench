import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True
    )

    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )

    agent_module: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Python module path to the agent class"
    )
    agent_class: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Assistant", comment="Agent class name"
    )

    llm_model: Mapped[str] = mapped_column(String(255), default="gpt-4o-mini")
    judge_model: Mapped[str] = mapped_column(String(255), default="gpt-4o-mini")

    chat_history: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="Pre-loaded conversation history"
    )
    agent_args: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="Keyword arguments passed to the agent constructor"
    )
    mock_tools: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="Tool mock definitions"
    )
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    turns: Mapped[list["ScenarioTurn"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", order_by="ScenarioTurn.turn_index"
    )
    test_runs: Mapped[list["TestRun"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", passive_deletes=True
    )
    revisions: Mapped[list["ScenarioRevision"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", order_by="ScenarioRevision.version"
    )
    agent: Mapped["Agent | None"] = relationship(back_populates="scenarios")


class ScenarioTurn(Base):
    __tablename__ = "scenario_turns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    user_input: Mapped[str] = mapped_column(Text, nullable=False)

    expectations: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        comment="List of expected events: message, function_call, function_call_output, handoff",
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scenario: Mapped["Scenario"] = relationship(back_populates="turns")


class ScenarioRevision(Base):
    __tablename__ = "scenario_revisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scenario: Mapped["Scenario"] = relationship(back_populates="revisions")


# Avoid circular import
from app.models.test_run import TestRun  # noqa: E402
from app.models.agent import Agent  # noqa: E402
