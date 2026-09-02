"""Write-only telemetry_events table. No onupdate. Same engine as inventory."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, Index, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.engine import Dialect
from sqlalchemy.types import CHAR, JSON, TypeDecorator
from sqlmodel import Field, SQLModel

TagsJson = JSONB().with_variant(JSON(), "sqlite")


class Guid(TypeDecorator):
    """UUID on Postgres; CHAR(36) on SQLite so tests can bind uuid4() values."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value: UUID | str | None, dialect: Dialect) -> UUID | str | None:
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, UUID) else UUID(str(value))
        return str(value)

    def process_result_value(self, value: UUID | str | None, dialect: Dialect) -> UUID | None:
        if value is None:
            return value
        return value if isinstance(value, UUID) else UUID(str(value))


class TelemetryEventRow(SQLModel, table=True):
    __tablename__ = "telemetry_events"
    __table_args__ = (
        CheckConstraint("level IN ('info', 'warn', 'error')", name="ck_telemetry_events_level"),
        Index("ix_telemetry_events_timestamp", "timestamp"),
        Index("ix_telemetry_events_event_type", "event_type"),
        Index("ix_telemetry_events_tags_gin", "tags", postgresql_using="gin"),
    )

    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(Guid(), primary_key=True, nullable=False),
    )
    timestamp: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    service: str = Field(sa_column=Column(Text, nullable=False))
    event_type: str = Field(sa_column=Column(Text, nullable=False))
    level: str = Field(
        default="info",
        sa_column=Column(Text, nullable=False, server_default=text("'info'")),
    )
    value: Decimal | None = Field(default=None, sa_column=Column(Numeric, nullable=True))
    message: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    tags: dict = Field(
        default_factory=dict,
        sa_column=Column(TagsJson, nullable=False, server_default=text("'{}'")),
    )
