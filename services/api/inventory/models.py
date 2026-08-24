"""SQLModel table definitions for medical supply inventory.

`current_stock` is never stored — it is computed from deliveries minus consumptions.
There is no User table: `user_uuid` is the TinyDB user id as a string.
Links are foreign keys on `supply_id` (explicit joins in the service layer).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MedicalSupply(SQLModel, table=True):
    __tablename__ = "medical_supplies"
    __table_args__ = (UniqueConstraint("sku", name="uq_medical_supplies_sku"),)

    id: int | None = Field(default=None, primary_key=True)
    name: str
    sku: str = Field(index=True)
    category: str
    unit: str
    country: str


class SupplyDelivery(SQLModel, table=True):
    __tablename__ = "supply_deliveries"

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(foreign_key="medical_supplies.id", index=True)
    quantity: int
    vendor_name: str
    clinic_id: int
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    user_uuid: str


class SupplyConsumption(SQLModel, table=True):
    __tablename__ = "supply_consumptions"

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(foreign_key="medical_supplies.id", index=True)
    quantity: int
    consumption_type: str
    clinic_id: int
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    user_uuid: str
