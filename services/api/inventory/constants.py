"""Shared inventory domain constants and error messages."""

from __future__ import annotations

from enum import StrEnum

CLINIC_ID_MIN = 1
CLINIC_ID_MAX = 12

SUPPLY_NOT_FOUND = "Supply not found."


class SupplyCategory(StrEnum):
    PPE = "ppe"
    WOUND_CARE = "wound_care"
    DIAGNOSTICS = "diagnostics"
    MEDICATIONS = "medications"
    CONSUMABLES = "consumables"


class SupplyCountry(StrEnum):
    US = "US"
    UK = "UK"


class ConsumptionType(StrEnum):
    CLINICAL_USE = "clinical_use"
    EXPIRY_WASTE = "expiry_waste"


def duplicate_sku_message(sku: str) -> str:
    return f"A supply with SKU '{sku}' already exists."


def insufficient_stock_message(name: str, available: int, quantity: int) -> str:
    return (
        f"Insufficient stock for supply '{name}'. "
        f"Available: {available}, requested: {quantity}."
    )
