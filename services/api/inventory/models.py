"""SQLModel table definitions for medical supply inventory.

`current_stock` is never stored — it is computed from deliveries minus consumptions.
There is no User table: `user_uuid` is the TinyDB user id as a string.
Links are foreign keys on `supply_id` (explicit joins in the service layer).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MedicalSupply(SQLModel, table=True):
    __tablename__ = "medical_supplies"
    __table_args__ = (UniqueConstraint("sku", name="uq_medical_supplies_sku"),)

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    sku: str = Field(index=True, max_length=64)
    category: str = Field(max_length=32)
    unit: str = Field(max_length=32)
    country: str = Field(max_length=8)


class SupplyDelivery(SQLModel, table=True):
    __tablename__ = "supply_deliveries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_supply_deliveries_quantity_positive"),
        CheckConstraint("clinic_id >= 1 AND clinic_id <= 12", name="ck_supply_deliveries_clinic_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(foreign_key="medical_supplies.id", index=True)
    quantity: int
    vendor_name: str = Field(max_length=200)
    clinic_id: int
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    user_uuid: str = Field(max_length=64)


class SupplyConsumption(SQLModel, table=True):
    __tablename__ = "supply_consumptions"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_supply_consumptions_quantity_positive"),
        CheckConstraint("clinic_id >= 1 AND clinic_id <= 12", name="ck_supply_consumptions_clinic_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(foreign_key="medical_supplies.id", index=True)
    quantity: int
    consumption_type: str = Field(max_length=32)
    clinic_id: int
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    user_uuid: str = Field(max_length=64)
