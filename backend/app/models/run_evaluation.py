"""
Run-level evaluation: overall success, conversation metrics, judge output.

Complements turn-level results so we can answer "did this conversation succeed?"
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RunEvaluation(Base):
    __tablename__ = "run_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False
    )

    metrics: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="e.g. task_success, conversation_score, latency_score",
    )
    judge_output: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="model, reasoning, verdict from run-level judge",
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    test_run: Mapped["TestRun"] = relationship("TestRun", back_populates="run_evaluation")


from app.models.test_run import TestRun  # noqa: E402
