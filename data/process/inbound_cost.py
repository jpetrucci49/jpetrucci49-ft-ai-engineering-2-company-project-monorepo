"""Supply cost for inbound_order_created — never a patient field."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


def _decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def inbound_event_cost(tags: dict[str, Any] | None, value: Any = None) -> tuple[Decimal, bool]:
    """Return (cost, missing_cost).

    Cost = tags.total_cost if present, else quantity × unit_cost.
    Missing cost contributes 0 and sets missing_cost=True (PIPELINE_DESIGN.md §4.1).
    """
    tags = tags or {}
    total = _decimal(tags.get("total_cost"))
    if total is not None:
        return total, False

    unit = _decimal(tags.get("unit_cost"))
    quantity = _decimal(tags.get("quantity"))
    if quantity is None:
        quantity = _decimal(value)
    if unit is not None and quantity is not None:
        return unit * quantity, False

    return Decimal("0"), True
