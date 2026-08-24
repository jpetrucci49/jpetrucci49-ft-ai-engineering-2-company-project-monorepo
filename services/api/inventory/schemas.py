"""Request and response schemas for the inventory API.

Separate from SQLModel table classes. `current_stock` appears only on responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from inventory.constants import (
    CLINIC_ID_MAX,
    CLINIC_ID_MIN,
    ConsumptionType,
    SupplyCategory,
    SupplyCountry,
)


def _strip_required(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be empty")
        return stripped
    return value


class MedicalSupplyCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    category: SupplyCategory
    unit: str = Field(min_length=1)
    country: SupplyCountry

    @field_validator("name", "sku", "unit", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return _strip_required(value)


class MedicalSupplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    category: str
    unit: str
    country: str
    current_stock: int


class MedicalSupplySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    category: str
    unit: str
    country: str


class SupplyDeliveryCreate(BaseModel):
    supply_id: int
    quantity: int = Field(gt=0)
    vendor_name: str = Field(min_length=1)
    clinic_id: int = Field(ge=CLINIC_ID_MIN, le=CLINIC_ID_MAX)

    @field_validator("vendor_name", mode="before")
    @classmethod
    def strip_vendor_name(cls, value: object) -> object:
        return _strip_required(value)


class SupplyDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supply_id: int
    quantity: int
    vendor_name: str
    clinic_id: int
    created_at: datetime
    user_uuid: str
    supply: MedicalSupplySummary


class SupplyConsumptionCreate(BaseModel):
    supply_id: int
    quantity: int = Field(gt=0)
    consumption_type: ConsumptionType
    clinic_id: int = Field(ge=CLINIC_ID_MIN, le=CLINIC_ID_MAX)


class SupplyConsumptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supply_id: int
    quantity: int
    consumption_type: str
    clinic_id: int
    created_at: datetime
    user_uuid: str
    supply: MedicalSupplySummary


class InventoryOrderResponse(BaseModel):
    order_type: Literal["inbound", "outbound"]
    id: int
    supply_id: int
    supply_name: str
    sku: str
    quantity: int
    clinic_id: int
    created_at: datetime
    user_uuid: str
    vendor_name: str | None = None
    consumption_type: str | None = None
