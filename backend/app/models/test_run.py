import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False
    )
    suite_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suites.id", ondelete="SET NULL"), nullable=True
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus), default=RunStatus.PENDING, nullable=False
    )
    config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="Override config for this run"
    )

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    agent_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_versions.id", ondelete="SET NULL"), nullable=True
    )
    execution_snapshot: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Resolved agent config, final prompt, tools, scenario snapshot for replay",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scenario: Mapped["Scenario"] = relationship(back_populates="test_runs")
    turn_results: Mapped[list["TurnResult"]] = relationship(
        back_populates="test_run", cascade="all, delete-orphan", order_by="TurnResult.turn_index"
    )
    agent_version: Mapped["AgentVersion | None"] = relationship(
        "AgentVersion", back_populates="test_runs", foreign_keys=[agent_version_id]
    )
    run_evaluation: Mapped["RunEvaluation | None"] = relationship(
        "RunEvaluation", back_populates="test_run", uselist=False, cascade="all, delete-orphan"
    )


class TurnResult(Base):
    __tablename__ = "turn_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    user_input: Mapped[str] = mapped_column(Text, nullable=False)

    events: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, comment="Captured events from RunResult (legacy)"
    )
    expectations: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, comment="Expected events from scenario"
    )
    structured_events: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Structured: messages[], tool_calls[], reasoning for replay/debug",
    )

    passed: Mapped[bool | None] = mapped_column(nullable=True)
    judge_verdicts: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="LLM judge results for each assertion"
    )

    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    input_audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    stt_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    tts_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    interruption: Mapped[bool | None] = mapped_column(nullable=True, comment="Barge-in / user interrupted")

    test_run: Mapped["TestRun"] = relationship(back_populates="turn_results")


from app.models.scenario import Scenario  # noqa: E402, F811
