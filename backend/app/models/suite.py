import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

suite_scenarios = Table(
    "suite_scenarios",
    Base.metadata,
    Column("suite_id", UUID(as_uuid=True), ForeignKey("suites.id", ondelete="CASCADE")),
    Column("scenario_id", UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE")),
)


class Suite(Base):
    __tablename__ = "suites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    scenarios: Mapped[list["Scenario"]] = relationship(
        secondary=suite_scenarios, lazy="selectin"
    )


from app.models.scenario import Scenario  # noqa: E402, F811
