#!/usr/bin/env python3
"""Load HealthCore medical-supply catalogue and sample movements into PostgreSQL.

Idempotent by SKU for supplies. Movements are inserted only when the deliveries
table is empty, so re-running does not double-count stock.

Reset (dev only):
    uv run --env-file .env python seed_inventory.py --reset
"""

from __future__ import annotations

import argparse
import sys

from sqlmodel import Session, select

from auth.database import get_users_table
from inventory.constants import ConsumptionType, SupplyCategory, SupplyCountry
from inventory.database import connection_error_hint, get_engine, init_inventory_schema, load_local_env
from inventory.models import MedicalSupply, SupplyConsumption, SupplyDelivery
from inventory.schemas import MedicalSupplyCreate, SupplyConsumptionCreate, SupplyDeliveryCreate
from inventory.service import (
    compute_current_stock,
    create_supply,
    list_supplies,
    register_consumption,
    register_delivery,
)

SUPPLIES_SEED: list[dict] = [
    {
        "name": "Nitrile gloves (box of 100)",
        "sku": "HCR-PPE-001",
        "category": SupplyCategory.PPE,
        "unit": "box",
        "country": SupplyCountry.US,
    },
    {
        "name": "Surgical mask (pack of 50)",
        "sku": "HCR-PPE-002",
        "category": SupplyCategory.PPE,
        "unit": "pack",
        "country": SupplyCountry.UK,
    },
    {
        "name": "Adhesive wound dressing",
        "sku": "HCR-WND-001",
        "category": SupplyCategory.WOUND_CARE,
        "unit": "box",
        "country": SupplyCountry.US,
    },
    {
        "name": "Rapid strep test kit",
        "sku": "HCR-DIAG-001",
        "category": SupplyCategory.DIAGNOSTICS,
        "unit": "unit",
        "country": SupplyCountry.US,
    },
    {
        "name": "Blood glucose test strips (50)",
        "sku": "HCR-DIAG-002",
        "category": SupplyCategory.DIAGNOSTICS,
        "unit": "box",
        "country": SupplyCountry.UK,
    },
    {
        "name": "0.9% Saline solution 500ml",
        "sku": "HCR-MED-001",
        "category": SupplyCategory.MEDICATIONS,
        "unit": "vial",
        "country": SupplyCountry.US,
    },
]

# Quantities keyed by SKU; applied after supplies exist.
DELIVERIES_SEED: list[dict] = [
    {"sku": "HCR-PPE-001", "quantity": 40, "vendor_name": "MedLine Industries", "clinic_id": 1},
    {"sku": "HCR-PPE-001", "quantity": 25, "vendor_name": "Bound Tree Medical", "clinic_id": 5},
    {"sku": "HCR-PPE-002", "quantity": 20, "vendor_name": "Cardinal Health UK", "clinic_id": 11},
    {"sku": "HCR-WND-001", "quantity": 15, "vendor_name": "MedLine Industries", "clinic_id": 3},
]

CONSUMPTIONS_SEED: list[dict] = [
    {
        "sku": "HCR-PPE-001",
        "quantity": 10,
        "consumption_type": ConsumptionType.CLINICAL_USE,
        "clinic_id": 1,
    },
    {
        "sku": "HCR-PPE-001",
        "quantity": 5,
        "consumption_type": ConsumptionType.EXPIRY_WASTE,
        "clinic_id": 5,
    },
    {
        "sku": "HCR-PPE-002",
        "quantity": 4,
        "consumption_type": ConsumptionType.CLINICAL_USE,
        "clinic_id": 11,
    },
]


def _seed_user_uuid() -> str:
    users = get_users_table().all()
    if not users:
        raise RuntimeError(
            "No users found in auth TinyDB. Register a user (POST /users or the "
            "backoffice /register page) before seeding inventory."
        )
    user_id = users[0].get("id")
    if user_id is None:
        raise RuntimeError("Auth user record is missing an id.")
    return str(user_id)


def _sku_to_id(session: Session) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for supply in session.exec(select(MedicalSupply)).all():
        if supply.id is None:
            continue
        mapping[supply.sku] = supply.id
    return mapping


def _reset_tables() -> None:
    from sqlmodel import SQLModel

    import inventory.models  # noqa: F401

    engine = get_engine()
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def run_seed(*, reset: bool) -> int:
    if reset:
        _reset_tables()
        print("Inventory tables dropped and recreated.")
    else:
        init_inventory_schema()

    user_uuid = _seed_user_uuid()
    engine = get_engine()

    with Session(engine) as session:
        inserted_supplies = 0
        for entry in SUPPLIES_SEED:
            payload = MedicalSupplyCreate.model_validate(entry)
            existing = session.exec(
                select(MedicalSupply).where(MedicalSupply.sku == payload.sku)
            ).first()
            if existing is not None:
                continue
            create_supply(session, payload)
            inserted_supplies += 1
        session.commit()

        sku_ids = _sku_to_id(session)
        existing_deliveries = session.exec(select(SupplyDelivery)).first()
        inserted_deliveries = 0
        inserted_consumptions = 0

        if existing_deliveries is None:
            for entry in DELIVERIES_SEED:
                supply_id = sku_ids[entry["sku"]]
                register_delivery(
                    session,
                    SupplyDeliveryCreate(
                        supply_id=supply_id,
                        quantity=entry["quantity"],
                        vendor_name=entry["vendor_name"],
                        clinic_id=entry["clinic_id"],
                    ),
                    user_uuid,
                )
                inserted_deliveries += 1

            for entry in CONSUMPTIONS_SEED:
                supply_id = sku_ids[entry["sku"]]
                register_consumption(
                    session,
                    SupplyConsumptionCreate(
                        supply_id=supply_id,
                        quantity=entry["quantity"],
                        consumption_type=entry["consumption_type"],
                        clinic_id=entry["clinic_id"],
                    ),
                    user_uuid,
                )
                inserted_consumptions += 1
            session.commit()
        else:
            print("Deliveries already present — skipping movement seed.")

        products = list_supplies(session)
        delivery_count = len(session.exec(select(SupplyDelivery)).all())
        consumption_count = len(session.exec(select(SupplyConsumption)).all())

    print(
        f"Inventory seed finished: {inserted_supplies} supply(ies) inserted "
        f"({len(products)} total), {inserted_deliveries} delivery(ies), "
        f"{inserted_consumptions} consumption(s)."
    )
    print(f"user_uuid used: {user_uuid}")
    print(f"Movements in database: {delivery_count} deliveries, {consumption_count} consumptions.")
    print("current_stock by SKU:")
    with Session(engine) as session:
        sku_ids = _sku_to_id(session)
        for sku, supply_id in sorted(sku_ids.items()):
            stock = compute_current_stock(session, supply_id)
            print(f"  {sku}: {stock}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed HealthCore medical supply inventory.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop and recreate inventory tables (development only).",
    )
    args = parser.parse_args()

    load_local_env()
    try:
        return run_seed(reset=args.reset)
    except RuntimeError as exc:
        print(f"Inventory seeder failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(
            f"Inventory seeder failed ({type(exc).__name__}): {exc}",
            file=sys.stderr,
        )
        hint = connection_error_hint(exc)
        if hint:
            print(hint, file=sys.stderr)
        else:
            print("Check SUPABASE_DATABASE_URL and database connectivity.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
