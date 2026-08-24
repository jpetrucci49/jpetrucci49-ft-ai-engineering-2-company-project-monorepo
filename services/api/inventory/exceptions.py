"""Domain errors for inventory operations. Mapped to HTTP in the router."""

from __future__ import annotations

from inventory.constants import duplicate_sku_message, insufficient_stock_message


class InventoryError(Exception):
    """Base class for inventory business-rule failures."""


class SupplyNotFoundError(InventoryError):
    def __init__(self, supply_id: int) -> None:
        self.supply_id = supply_id
        super().__init__("Supply not found.")


class DuplicateSkuError(InventoryError):
    def __init__(self, sku: str) -> None:
        self.sku = sku
        super().__init__(duplicate_sku_message(sku))


class InsufficientStockError(InventoryError):
    def __init__(self, name: str, available: int, quantity: int) -> None:
        self.name = name
        self.available = available
        self.quantity = quantity
        super().__init__(insufficient_stock_message(name, available, quantity))
