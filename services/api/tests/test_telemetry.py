from __future__ import annotations

from typing import Any


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


def test_telemetry_batch_of_two_returns_received(inventory_client):
    response = inventory_client.post(
        "/telemetry/events",
        json={"events": [_event(), _event(event_type="login_succeeded")]},
    )
    assert response.status_code == 200
    assert response.json() == {"received": 2}


def test_telemetry_missing_event_id_returns_400(inventory_client):
    body = _event()
    del body["eventId"]
    response = inventory_client.post("/telemetry/events", json={"events": [body]})
    assert response.status_code == 400


def test_telemetry_empty_batch_returns_zero(inventory_client):
    response = inventory_client.post("/telemetry/events", json={"events": []})
    assert response.status_code == 200
    assert response.json() == {"received": 0}
