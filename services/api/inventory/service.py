"""Stock computation and inventory order rules.

`current_stock` is always `SUM(deliveries) - SUM(consumptions)` per supply,
across all clinics. Clinic IDs are metadata only for this milestone.
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, func, select

from inventory.exceptions import DuplicateSkuError, InsufficientStockError, SupplyNotFoundError
from inventory.models import MedicalSupply, SupplyConsumption, SupplyDelivery, utc_now
from inventory.schemas import (
    InventoryOrderResponse,
    MedicalSupplyCreate,
    MedicalSupplyResponse,
    MedicalSupplySummary,
    SupplyConsumptionCreate,
    SupplyConsumptionResponse,
    SupplyDeliveryCreate,
    SupplyDeliveryResponse,
)


def _require_id(value: int | None) -> int:
    if value is None:
        raise RuntimeError("Expected a persisted primary key.")
    return value


def _supply_summary(supply: MedicalSupply) -> MedicalSupplySummary:
    return MedicalSupplySummary(
        id=_require_id(supply.id),
        name=supply.name,
        sku=supply.sku,
        category=supply.category,
        unit=supply.unit,
        country=supply.country,
    )


def _to_supply_response(supply: MedicalSupply, stock: int) -> MedicalSupplyResponse:
    return MedicalSupplyResponse(
        id=_require_id(supply.id),
        name=supply.name,
        sku=supply.sku,
        category=supply.category,
        unit=supply.unit,
        country=supply.country,
        current_stock=stock,
    )


def get_supply_or_raise(session: Session, supply_id: int) -> MedicalSupply:
    supply = session.get(MedicalSupply, supply_id)
    if supply is None:
        raise SupplyNotFoundError(supply_id)
    return supply


def compute_current_stock(session: Session, supply_id: int) -> int:
    delivered = session.exec(
        select(func.coalesce(func.sum(SupplyDelivery.quantity), 0)).where(
            SupplyDelivery.supply_id == supply_id
        )
    ).one()
    consumed = session.exec(
        select(func.coalesce(func.sum(SupplyConsumption.quantity), 0)).where(
            SupplyConsumption.supply_id == supply_id
        )
    ).one()
    return int(delivered) - int(consumed)


def stock_by_supply_id(session: Session) -> dict[int, int]:
    deliveries = dict(
        session.exec(
            select(SupplyDelivery.supply_id, func.coalesce(func.sum(SupplyDelivery.quantity), 0)).group_by(
                SupplyDelivery.supply_id
            )
        ).all()
    )
    consumptions = dict(
        session.exec(
            select(
                SupplyConsumption.supply_id,
                func.coalesce(func.sum(SupplyConsumption.quantity), 0),
            ).group_by(SupplyConsumption.supply_id)
        ).all()
    )
    supply_ids = set(deliveries) | set(consumptions)
    return {
        supply_id: int(deliveries.get(supply_id, 0)) - int(consumptions.get(supply_id, 0))
        for supply_id in supply_ids
    }


def list_supplies(session: Session) -> list[MedicalSupplyResponse]:
    supplies = session.exec(select(MedicalSupply).order_by(col(MedicalSupply.id))).all()
    stocks = stock_by_supply_id(session)
    return [_to_supply_response(supply, stocks.get(_require_id(supply.id), 0)) for supply in supplies]


def get_supply(session: Session, supply_id: int) -> MedicalSupplyResponse:
    supply = get_supply_or_raise(session, supply_id)
    return _to_supply_response(supply, compute_current_stock(session, supply_id))


def create_supply(session: Session, payload: MedicalSupplyCreate) -> MedicalSupplyResponse:
    existing = session.exec(select(MedicalSupply).where(MedicalSupply.sku == payload.sku)).first()
    if existing is not None:
        raise DuplicateSkuError(payload.sku)

    supply = MedicalSupply(
        name=payload.name,
        sku=payload.sku,
        category=payload.category.value,
        unit=payload.unit,
        country=payload.country.value,
    )
    session.add(supply)
    try:
        session.flush()
    except IntegrityError as exc:
        raise DuplicateSkuError(payload.sku) from exc

    return _to_supply_response(supply, 0)


def register_delivery(
    session: Session,
    payload: SupplyDeliveryCreate,
    user_uuid: str,
) -> SupplyDeliveryResponse:
    supply = get_supply_or_raise(session, payload.supply_id)
    delivery = SupplyDelivery(
        supply_id=payload.supply_id,
        quantity=payload.quantity,
        vendor_name=payload.vendor_name,
        clinic_id=payload.clinic_id,
        created_at=utc_now(),
        user_uuid=user_uuid,
    )
    session.add(delivery)
    session.flush()
    return SupplyDeliveryResponse(
        id=_require_id(delivery.id),
        supply_id=delivery.supply_id,
        quantity=delivery.quantity,
        vendor_name=delivery.vendor_name,
        clinic_id=delivery.clinic_id,
        created_at=delivery.created_at,
        user_uuid=delivery.user_uuid,
        supply=_supply_summary(supply),
    )


def register_consumption(
    session: Session,
    payload: SupplyConsumptionCreate,
    user_uuid: str,
) -> SupplyConsumptionResponse:
    supply = get_supply_or_raise(session, payload.supply_id)
    available = compute_current_stock(session, payload.supply_id)
    if payload.quantity > available:
        raise InsufficientStockError(supply.name, available, payload.quantity)

    consumption = SupplyConsumption(
        supply_id=payload.supply_id,
        quantity=payload.quantity,
        consumption_type=payload.consumption_type.value,
        clinic_id=payload.clinic_id,
        created_at=utc_now(),
        user_uuid=user_uuid,
    )
    session.add(consumption)
    session.flush()
    return SupplyConsumptionResponse(
        id=_require_id(consumption.id),
        supply_id=consumption.supply_id,
        quantity=consumption.quantity,
        consumption_type=consumption.consumption_type,
        clinic_id=consumption.clinic_id,
        created_at=consumption.created_at,
        user_uuid=consumption.user_uuid,
        supply=_supply_summary(supply),
    )


def list_orders(session: Session) -> list[InventoryOrderResponse]:
    delivery_rows = session.exec(
        select(SupplyDelivery, MedicalSupply)
        .join(MedicalSupply, SupplyDelivery.supply_id == MedicalSupply.id)
        .order_by(col(SupplyDelivery.created_at), col(SupplyDelivery.id))
    ).all()
    consumption_rows = session.exec(
        select(SupplyConsumption, MedicalSupply)
        .join(MedicalSupply, SupplyConsumption.supply_id == MedicalSupply.id)
        .order_by(col(SupplyConsumption.created_at), col(SupplyConsumption.id))
    ).all()

    orders: list[InventoryOrderResponse] = []
    for delivery, supply in delivery_rows:
        orders.append(
            InventoryOrderResponse(
                order_type="inbound",
                id=_require_id(delivery.id),
                supply_id=delivery.supply_id,
                supply_name=supply.name,
                sku=supply.sku,
                quantity=delivery.quantity,
                clinic_id=delivery.clinic_id,
                created_at=delivery.created_at,
                user_uuid=delivery.user_uuid,
                vendor_name=delivery.vendor_name,
            )
        )
    for consumption, supply in consumption_rows:
        orders.append(
            InventoryOrderResponse(
                order_type="outbound",
                id=_require_id(consumption.id),
                supply_id=consumption.supply_id,
                supply_name=supply.name,
                sku=supply.sku,
                quantity=consumption.quantity,
                clinic_id=consumption.clinic_id,
                created_at=consumption.created_at,
                user_uuid=consumption.user_uuid,
                consumption_type=consumption.consumption_type,
            )
        )
    orders.sort(key=lambda item: (item.created_at, item.order_type, item.id))
    return orders
