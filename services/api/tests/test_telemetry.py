from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from inventory.database import get_engine
from telemetry.table import TelemetryEventRow


def _event(**overrides: Any) -> dict[str, Any]:
    payload = {
        "eventId": "11111111-1111-4111-8111-111111111111",
        "timestamp": "2026-08-31T20:00:00.000Z",
        "sessionId": "22222222-2222-4222-8222-222222222222",
        "userId": "1",
        "event_type": "page_viewed",
        "schemaVersion": "1.0.0",
        "requestId": "33333333-3333-4333-8333-333333333333",
        "properties": {"route": "/"},
    }
    payload.update(overrides)
    return payload


def _inbound(**overrides: Any) -> dict[str, Any]:
    return _event(
        eventId="aaaaaaaa-1111-4111-8111-111111111111",
        event_type="inbound_order_created",
        properties={
            "clinic_id": 1,
            "country": "US",
            "product_id": 42,
            "product_category": "ppe",
            "quantity": 10,
            "vendor_name": "MedSupply Co",
            "order_id": 7,
            "sku": "HCR-PPE-001",
            "email": "staff@healthcore.example",
        },
        **overrides,
    )


def _stored_rows() -> list[TelemetryEventRow]:
    with Session(get_engine()) as session:
        return list(session.exec(select(TelemetryEventRow)).all())


def test_telemetry_two_valid_events_are_stored(inventory_client):
    response = inventory_client.post(
        "/telemetry/events",
        json={"events": [_event(), _event(event_type="login_succeeded", properties={"role": "admin"})]},
    )
    assert response.status_code == 200
    assert response.json() == {"received": 2, "stored": 2, "rejected": 0}
    rows = _stored_rows()
    assert len(rows) == 2
    assert {row.event_type for row in rows} == {"page_viewed", "login_succeeded"}


def test_telemetry_partial_batch_stores_valid_only(inventory_client):
    invalid = _event()
    del invalid["eventId"]
    response = inventory_client.post(
        "/telemetry/events",
        json={"events": [_event(), invalid]},
    )
    assert response.status_code == 200
    assert response.json() == {"received": 2, "stored": 1, "rejected": 1}
    assert len(_stored_rows()) == 1


def test_telemetry_empty_batch_returns_zeros(inventory_client):
    response = inventory_client.post("/telemetry/events", json={"events": []})
    assert response.status_code == 200
    assert response.json() == {"received": 0, "stored": 0, "rejected": 0}
    assert _stored_rows() == []


def test_telemetry_missing_events_key_returns_400(inventory_client):
    response = inventory_client.post("/telemetry/events", json={})
    assert response.status_code == 400


def test_telemetry_events_not_array_returns_400(inventory_client):
    response = inventory_client.post("/telemetry/events", json={"events": {"nope": True}})
    assert response.status_code == 400


def test_telemetry_all_invalid_leaves_table_unchanged(inventory_client):
    inventory_client.post("/telemetry/events", json={"events": [_event()]})
    before = len(_stored_rows())
    assert before == 1

    response = inventory_client.post(
        "/telemetry/events",
        json={"events": [{"event_type": "not_enough"}, {"event_type": "also_bad"}]},
    )
    assert response.status_code == 200
    assert response.json() == {"received": 2, "stored": 0, "rejected": 2}
    assert len(_stored_rows()) == before


def test_telemetry_row_tags_are_allowlisted_without_pii(inventory_client):
    response = inventory_client.post("/telemetry/events", json={"events": [_inbound()]})
    assert response.status_code == 200
    assert response.json()["stored"] == 1

    row = _stored_rows()[0]
    assert row.event_type == "inbound_order_created"
    assert row.timestamp is not None
    assert row.service == "backoffice"
    assert row.level == "info"
    assert row.value == 10
    assert row.message == "inbound_order_created product_id=42"
    assert row.tags["eventId"] == "aaaaaaaa-1111-4111-8111-111111111111"
    assert row.tags["sessionId"] == "22222222-2222-4222-8222-222222222222"
    assert row.tags["userId"] == "1"
    assert row.tags["schemaVersion"] == "1.0.0"
    assert row.tags["requestId"] == "33333333-3333-4333-8333-333333333333"
    assert row.tags["clinic_id"] == 1
    assert row.tags["country"] == "US"
    assert row.tags["sku"] == "HCR-PPE-001"
    assert "email" not in row.tags


def test_telemetry_levels_from_event_type(inventory_client):
    response = inventory_client.post(
        "/telemetry/events",
        json={
            "events": [
                _event(event_type="login_failed", properties={"reason": "invalid_credentials"}),
                _event(
                    eventId="bbbbbbbb-1111-4111-8111-111111111111",
                    event_type="frontend_error_uncaught",
                    properties={"route": "/inventory/products", "name": "TypeError"},
                ),
            ]
        },
    )
    assert response.status_code == 200
    levels = {row.event_type: row.level for row in _stored_rows()}
    assert levels["login_failed"] == "warn"
    assert levels["frontend_error_uncaught"] == "error"

