"""Inventory API tests (M5.5).

Uses in-memory SQLite via `inventory_client` so CI does not need Supabase.
Limitation: dialect-specific Postgres behaviour is not exercised.
"""

from __future__ import annotations

from inventory.constants import insufficient_stock_message
from pydantic import ValidationError
import pytest

from inventory.schemas import MedicalSupplyCreate, SupplyConsumptionCreate, SupplyDeliveryCreate


GLOVES = {
    "name": "Nitrile gloves (box of 100)",
    "sku": "HCR-PPE-001",
    "category": "ppe",
    "unit": "box",
    "country": "US",
}

MASKS = {
    "name": "Surgical mask (pack of 50)",
    "sku": "HCR-PPE-002",
    "category": "ppe",
    "unit": "pack",
    "country": "UK",
}


def _create_supply(client, headers, payload=None) -> dict:
    body = payload or GLOVES
    response = client.post("/inventory/products", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _stock_by_sku(client, headers) -> dict[str, int]:
    response = client.get("/inventory/products", headers=headers)
    assert response.status_code == 200, response.text
    return {item["sku"]: item["current_stock"] for item in response.json()}


def test_i1_seeded_supplies_return_correct_current_stock(inventory_client, inventory_auth_headers):
    gloves = _create_supply(inventory_client, inventory_auth_headers, GLOVES)
    masks = _create_supply(inventory_client, inventory_auth_headers, MASKS)

    inbound = [
        {"supply_id": gloves["id"], "quantity": 40, "vendor_name": "MedLine Industries", "clinic_id": 1},
        {"supply_id": gloves["id"], "quantity": 25, "vendor_name": "Bound Tree Medical", "clinic_id": 5},
        {"supply_id": masks["id"], "quantity": 20, "vendor_name": "Cardinal Health UK", "clinic_id": 11},
    ]
    for payload in inbound:
        response = inventory_client.post(
            "/inventory/orders/inbound", json=payload, headers=inventory_auth_headers
        )
        assert response.status_code == 201, response.text

    outbound = [
        {
            "supply_id": gloves["id"],
            "quantity": 10,
            "consumption_type": "clinical_use",
            "clinic_id": 1,
        },
        {
            "supply_id": gloves["id"],
            "quantity": 5,
            "consumption_type": "expiry_waste",
            "clinic_id": 5,
        },
    ]
    for payload in outbound:
        response = inventory_client.post(
            "/inventory/orders/outbound", json=payload, headers=inventory_auth_headers
        )
        assert response.status_code == 201, response.text

    stocks = _stock_by_sku(inventory_client, inventory_auth_headers)
    assert stocks["HCR-PPE-001"] == 50  # 40 + 25 - 10 - 5
    assert stocks["HCR-PPE-002"] == 20


def test_i2_create_supply_starts_at_zero_stock(inventory_client, inventory_auth_headers):
    created = _create_supply(inventory_client, inventory_auth_headers)
    assert created["current_stock"] == 0
    assert created["country"] == "US"
    assert created["sku"] == "HCR-PPE-001"

    fetched = inventory_client.get(
        f"/inventory/products/{created['id']}", headers=inventory_auth_headers
    )
    assert fetched.status_code == 200
    assert fetched.json()["current_stock"] == 0


def test_i3_unknown_product_returns_404(inventory_client, inventory_auth_headers):
    response = inventory_client.get("/inventory/products/99999", headers=inventory_auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Supply not found."


def test_i4_inbound_delivery_increases_computed_stock(
    inventory_client, inventory_auth_headers, registered_user
):
    user, _ = registered_user
    supply = _create_supply(inventory_client, inventory_auth_headers)
    response = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": supply["id"],
            "quantity": 12,
            "vendor_name": "MedLine Industries",
            "clinic_id": 2,
        },
        headers=inventory_auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["quantity"] == 12
    assert body["clinic_id"] == 2
    assert body["user_uuid"] == str(user.id)
    assert body["supply"]["sku"] == "HCR-PPE-001"
    assert body["vendor_name"] == "MedLine Industries"

    stocks = _stock_by_sku(inventory_client, inventory_auth_headers)
    assert stocks["HCR-PPE-001"] == 12


def test_i5_outbound_consumption_decreases_stock(inventory_client, inventory_auth_headers):
    supply = _create_supply(inventory_client, inventory_auth_headers)
    inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": supply["id"],
            "quantity": 10,
            "vendor_name": "MedLine Industries",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "supply_id": supply["id"],
            "quantity": 3,
            "consumption_type": "clinical_use",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["consumption_type"] == "clinical_use"
    assert response.json()["clinic_id"] == 1

    stocks = _stock_by_sku(inventory_client, inventory_auth_headers)
    assert stocks["HCR-PPE-001"] == 7


def test_i6_outbound_exceeding_stock_returns_exact_message(inventory_client, inventory_auth_headers):
    supply = _create_supply(inventory_client, inventory_auth_headers)
    inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": supply["id"],
            "quantity": 4,
            "vendor_name": "MedLine Industries",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "supply_id": supply["id"],
            "quantity": 9,
            "consumption_type": "expiry_waste",
            "clinic_id": 3,
        },
        headers=inventory_auth_headers,
    )
    assert response.status_code == 400
    expected = insufficient_stock_message(GLOVES["name"], 4, 9)
    assert response.json()["detail"] == expected

    stocks = _stock_by_sku(inventory_client, inventory_auth_headers)
    assert stocks["HCR-PPE-001"] == 4


def test_i7_invalid_consumption_type_is_validation_error(inventory_client, inventory_auth_headers):
    supply = _create_supply(inventory_client, inventory_auth_headers)
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "supply_id": supply["id"],
            "quantity": 1,
            "consumption_type": "lost_in_cupboard",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    # M12 remaps FastAPI's default 422 validation errors to 400 with sanitized messages.
    assert response.status_code in (400, 422)
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    messages = " ".join(str(item.get("msg", "")) for item in detail)
    assert "Consumption type" in messages or "consumption_type" in messages.lower()
    assert all("input" not in item for item in detail)


def test_i8_orders_list_includes_deliveries_consumptions_and_user_uuid(
    inventory_client, inventory_auth_headers, registered_user
):
    user, _ = registered_user
    supply = _create_supply(inventory_client, inventory_auth_headers)
    inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": supply["id"],
            "quantity": 8,
            "vendor_name": "Cardinal Health UK",
            "clinic_id": 11,
        },
        headers=inventory_auth_headers,
    )
    inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "supply_id": supply["id"],
            "quantity": 2,
            "consumption_type": "clinical_use",
            "clinic_id": 11,
        },
        headers=inventory_auth_headers,
    )

    response = inventory_client.get("/inventory/orders", headers=inventory_auth_headers)
    assert response.status_code == 200, response.text
    orders = response.json()
    types = {item["order_type"] for item in orders}
    assert types == {"inbound", "outbound"}
    assert all(item["user_uuid"] == str(user.id) for item in orders)
    assert all(item["sku"] == "HCR-PPE-001" for item in orders)
    inbound = next(item for item in orders if item["order_type"] == "inbound")
    outbound = next(item for item in orders if item["order_type"] == "outbound")
    assert inbound["vendor_name"] == "Cardinal Health UK"
    assert inbound["clinic_id"] == 11
    assert outbound["consumption_type"] == "clinical_use"
    assert outbound["clinic_id"] == 11


def test_i9_unauthenticated_inventory_request_returns_401(inventory_client):
    response = inventory_client.get("/inventory/products")
    assert response.status_code == 401


def test_duplicate_sku_returns_409(inventory_client, inventory_auth_headers):
    _create_supply(inventory_client, inventory_auth_headers)
    response = inventory_client.post(
        "/inventory/products", json=GLOVES, headers=inventory_auth_headers
    )
    assert response.status_code == 409
    assert "HCR-PPE-001" in response.json()["detail"]


def test_inbound_unknown_supply_returns_404(inventory_client, inventory_auth_headers):
    response = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": 404,
            "quantity": 1,
            "vendor_name": "MedLine Industries",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Supply not found."


def test_outbound_on_zero_stock_returns_insufficient_message(
    inventory_client, inventory_auth_headers
):
    supply = _create_supply(inventory_client, inventory_auth_headers)
    response = inventory_client.post(
        "/inventory/orders/outbound",
        json={
            "supply_id": supply["id"],
            "quantity": 1,
            "consumption_type": "clinical_use",
            "clinic_id": 1,
        },
        headers=inventory_auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == insufficient_stock_message(GLOVES["name"], 0, 1)


def test_invalid_category_rejected_by_schema():
    with pytest.raises(ValidationError):
        MedicalSupplyCreate(
            name="X",
            sku="HCR-X-001",
            category="not-a-category",  # type: ignore[arg-type]
            unit="box",
            country="US",
        )


def test_clinic_id_out_of_range_rejected_by_schema():
    with pytest.raises(ValidationError):
        SupplyDeliveryCreate(
            supply_id=1,
            quantity=1,
            vendor_name="MedLine Industries",
            clinic_id=13,
        )


def test_quantity_must_be_positive():
    with pytest.raises(ValidationError):
        SupplyConsumptionCreate(
            supply_id=1,
            quantity=0,
            consumption_type="clinical_use",
            clinic_id=1,
        )


def test_no_direct_stock_mutation_endpoint(inventory_client, inventory_auth_headers):
    supply = _create_supply(inventory_client, inventory_auth_headers)
    response = inventory_client.patch(
        f"/inventory/products/{supply['id']}",
        json={"current_stock": 999},
        headers=inventory_auth_headers,
    )
    assert response.status_code in (404, 405)


def test_create_rejects_current_stock_in_body():
    with pytest.raises(ValidationError):
        MedicalSupplyCreate(**GLOVES, current_stock=999)  # type: ignore[arg-type]


def test_post_product_rejects_unknown_field(inventory_client, inventory_auth_headers):
    response = inventory_client.post(
        "/inventory/products",
        json={**GLOVES, "current_stock": 999},
        headers=inventory_auth_headers,
    )
    assert response.status_code in (400, 422)


def test_unauthenticated_inbound_returns_401(inventory_client):
    response = inventory_client.post(
        "/inventory/orders/inbound",
        json={
            "supply_id": 1,
            "quantity": 1,
            "vendor_name": "MedLine Industries",
            "clinic_id": 1,
        },
    )
    assert response.status_code == 401


def test_redact_secrets_strips_connection_uris():
    from inventory.database import redact_secrets

    leaked = (
        "failed: postgresql+psycopg://postgres.abc:s3cret@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
    )
    redacted = redact_secrets(leaked)
    assert "s3cret" not in redacted
    assert "postgresql+psycopg://***" in redacted


def test_postgres_reset_blocked_without_flag(monkeypatch):
    from inventory.database import assert_destructive_reset_allowed

    monkeypatch.setenv(
        "SUPABASE_DATABASE_URL",
        "postgresql+psycopg://postgres.demo:x@aws-0-us-west-2.pooler.supabase.com:5432/postgres",
    )
    monkeypatch.delenv("INVENTORY_ALLOW_RESET", raising=False)
    with pytest.raises(RuntimeError, match="INVENTORY_ALLOW_RESET"):
        assert_destructive_reset_allowed()
