"""Inventory HTTP routes under `/inventory`. All handlers require JWT auth."""

from __future__ import annotations

from typing import Annotated, NoReturn

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from auth.dependencies import get_current_user
from auth.models import UserPublic
from inventory import service as inventory_service
from inventory.database import get_db
from inventory.exceptions import DuplicateSkuError, InsufficientStockError, InventoryError, SupplyNotFoundError
from inventory.schemas import (
    InventoryOrderResponse,
    MedicalSupplyCreate,
    MedicalSupplyResponse,
    SupplyConsumptionCreate,
    SupplyConsumptionResponse,
    SupplyDeliveryCreate,
    SupplyDeliveryResponse,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

CurrentUser = Annotated[UserPublic, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


def _raise_http(exc: InventoryError) -> NoReturn:
    if isinstance(exc, SupplyNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, DuplicateSkuError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, InsufficientStockError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected error occurred.",
    ) from exc


@router.get("/products", response_model=list[MedicalSupplyResponse])
def list_products(
    session: DbSession,
    _: CurrentUser,
) -> list[MedicalSupplyResponse]:
    return inventory_service.list_supplies(session)


@router.post("/products", response_model=MedicalSupplyResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: MedicalSupplyCreate,
    session: DbSession,
    _: CurrentUser,
) -> MedicalSupplyResponse:
    try:
        return inventory_service.create_supply(session, payload)
    except InventoryError as exc:
        _raise_http(exc)


@router.get("/products/{supply_id}", response_model=MedicalSupplyResponse)
def get_product(
    supply_id: int,
    session: DbSession,
    _: CurrentUser,
) -> MedicalSupplyResponse:
    try:
        return inventory_service.get_supply(session, supply_id)
    except InventoryError as exc:
        _raise_http(exc)


@router.post(
    "/orders/inbound",
    response_model=SupplyDeliveryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inbound_order(
    payload: SupplyDeliveryCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> SupplyDeliveryResponse:
    try:
        return inventory_service.register_delivery(session, payload, str(current_user.id))
    except InventoryError as exc:
        _raise_http(exc)


@router.post(
    "/orders/outbound",
    response_model=SupplyConsumptionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_outbound_order(
    payload: SupplyConsumptionCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> SupplyConsumptionResponse:
    try:
        return inventory_service.register_consumption(session, payload, str(current_user.id))
    except InventoryError as exc:
        _raise_http(exc)


@router.get("/orders", response_model=list[InventoryOrderResponse])
def list_orders(
    session: DbSession,
    _: CurrentUser,
) -> list[InventoryOrderResponse]:
    return inventory_service.list_orders(session)
