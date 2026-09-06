"""Monthly Clinic Supply Performance pipeline + reporting endpoints."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest

from data.pipelines.paths import ensure_import_paths

ensure_import_paths()

from prefect.testing.utilities import prefect_test_harness

from data.pipelines.monthly_clinic_supply_performance.flow import (
    run_monthly_clinic_supply_performance,
)
from data.pipelines.monthly_clinic_supply_performance.queries import (
    query_monthly_clinic_supply_performance,
)
from data.process.clinic_month_kpis import compute_clinic_month_kpis
from data.process.inbound_cost import inbound_event_cost
from inventory.database import get_engine
from sqlmodel import Session, select
from telemetry.table import TelemetryEventRow


@pytest.fixture(scope="module", autouse=True)
def _prefect_test_runtime() -> Iterator[None]:
    """Own the ephemeral Prefect API so it stops before pytest closes stdout."""
    with prefect_test_harness():
        yield


def _event(**overrides: Any) -> dict[str, Any]:
    payload = {
        "eventId": "11111111-1111-4111-8111-111111111111",
        "timestamp": "2026-08-10T12:00:00.000Z",
        "sessionId": "22222222-2222-4222-8222-222222222222",
        "userId": "1",
        "event_type": "page_viewed",
        "schemaVersion": "1.0.0",
        "requestId": "33333333-3333-4333-8333-333333333333",
        "properties": {},
    }
    payload.update(overrides)
    return payload


def _seed_august_events(client) -> None:
    events = [
        _event(
            eventId="aaaaaaaa-0001-4111-8111-000000000001",
            event_type="inbound_order_created",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 10,
                "vendor_name": "MedSupply Co",
                "order_id": 1,
                "unit_cost": 12.5,
            },
        ),
        _event(
            eventId="aaaaaaaa-0001-4111-8111-000000000001",
            timestamp="2026-08-10T12:01:00.000Z",
            event_type="inbound_order_created",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 10,
                "vendor_name": "MedSupply Co",
                "order_id": 1,
                "unit_cost": 12.5,
            },
        ),
        _event(
            eventId="aaaaaaaa-0002-4111-8111-000000000002",
            timestamp="2026-08-12T09:00:00.000Z",
            event_type="outbound_order_created",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 2,
                "department": "general_consultation",
                "consumption_type": "clinical_use",
                "order_id": 2,
            },
        ),
        _event(
            eventId="aaaaaaaa-0003-4111-8111-000000000003",
            timestamp="2026-08-13T09:00:00.000Z",
            event_type="stock_threshold_triggered",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 4,
                "threshold_value": 10,
                "threshold_kind": "low",
                "trigger_order_type": "outbound",
            },
        ),
        _event(
            eventId="aaaaaaaa-0004-4111-8111-000000000004",
            timestamp="2026-08-14T09:00:00.000Z",
            event_type="supply_expiry_flagged",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 1,
                "expiry_date": "2026-09-01",
                "days_to_expiry": 18,
                "department": "pharmacy",
            },
        ),
        _event(
            eventId="bbbbbbbb-0001-4111-8111-000000000001",
            timestamp="2026-08-06T10:00:00.000Z",
            event_type="inbound_order_created",
            properties={
                "clinic_id": 10,
                "country": "UK",
                "product_id": 21,
                "product_category": "medication",
                "quantity": 8,
                "vendor_name": "NHS Supply",
                "order_id": 9,
                "total_cost": 24,
            },
        ),
        _event(
            eventId="ffffffff-0001-4111-8111-000000000001",
            timestamp="2026-07-15T10:00:00.000Z",
            event_type="outbound_order_created",
            properties={
                "clinic_id": 2,
                "country": "US",
                "product_id": 11,
                "product_category": "ppe",
                "quantity": 50,
                "department": "general_consultation",
                "consumption_type": "clinical_use",
                "order_id": 99,
            },
        ),
    ]
    response = client.post("/telemetry/events", json={"events": events})
    assert response.status_code == 200
    assert response.json()["stored"] == 7


def test_inbound_cost_prefers_total_then_unit_times_qty():
    cost, missing = inbound_event_cost({"total_cost": 24, "unit_cost": 9, "quantity": 8})
    assert float(cost) == 24
    assert missing is False
    cost, missing = inbound_event_cost({"unit_cost": 12.5, "quantity": 10})
    assert float(cost) == 125
    assert missing is False
    cost, missing = inbound_event_cost({"quantity": 5})
    assert float(cost) == 0
    assert missing is True


def test_transform_dedupes_and_maps_clinic_slugs():
    events = [
        {
            "timestamp": "2026-08-04T14:00:00+00:00",
            "event_type": "inbound_order_created",
            "value": 10,
            "tags": {
                "clinic_id": 2,
                "country": "US",
                "quantity": 10,
                "unit_cost": 12.5,
                "eventId": "same",
            },
        },
        {
            "timestamp": "2026-08-04T14:01:00+00:00",
            "event_type": "inbound_order_created",
            "value": 10,
            "tags": {
                "clinic_id": 2,
                "country": "US",
                "quantity": 10,
                "unit_cost": 12.5,
                "eventId": "same",
            },
        },
        {
            "timestamp": "2026-08-05T16:00:00+00:00",
            "event_type": "outbound_order_created",
            "tags": {"clinic_id": 2, "country": "US", "eventId": "out-1"},
        },
        {
            "timestamp": "2026-08-06T10:00:00+00:00",
            "event_type": "inbound_order_created",
            "tags": {
                "clinic_id": 10,
                "country": "UK",
                "total_cost": 24,
                "eventId": "uk-1",
            },
        },
        {
            "timestamp": "2026-08-07T12:00:00+00:00",
            "event_type": "inbound_order_created",
            "tags": {"clinic_id": 99, "country": "US", "unit_cost": 10, "eventId": "drop"},
        },
    ]
    rows, missing = compute_clinic_month_kpis(events, date(2026, 8, 1))
    by_clinic = {row["clinic_id"]: row for row in rows}
    assert set(by_clinic) == {"austin-north", "london-city"}
    assert by_clinic["austin-north"]["total_supply_cost"] == 125.0
    assert by_clinic["austin-north"]["supply_consumption_count"] == 1
    assert by_clinic["austin-north"]["currency"] == "USD"
    assert by_clinic["london-city"]["total_supply_cost"] == 24.0
    assert by_clinic["london-city"]["currency"] == "GBP"
    assert missing == 0


def test_unit_cost_is_stored_on_inbound(inventory_client):
    response = inventory_client.post(
        "/telemetry/events",
        json={
            "events": [
                _event(
                    event_type="inbound_order_created",
                    properties={
                        "clinic_id": 1,
                        "country": "US",
                        "product_id": 1,
                        "product_category": "ppe",
                        "quantity": 3,
                        "vendor_name": "MedSupply Co",
                        "order_id": 4,
                        "unit_cost": 7.25,
                    },
                )
            ]
        },
    )
    assert response.status_code == 200
    with Session(get_engine()) as session:
        row = session.exec(select(TelemetryEventRow)).one()
    assert row.tags["unit_cost"] == 7.25


def test_reporting_endpoints_require_auth(inventory_client):
    assert inventory_client.get("/reporting/monthly-clinic-supply-performance").status_code == 401
    assert inventory_client.get("/reporting/pipeline-runs/latest").status_code == 401
    assert inventory_client.post("/reporting/pipeline-runs").status_code == 401


def test_kpi_query_empty_month(inventory_client, inventory_auth_headers):
    response = inventory_client.get(
        "/reporting/monthly-clinic-supply-performance",
        headers=inventory_auth_headers,
        params={"month_start": "2026-08-01"},
    )
    assert response.status_code == 200
    assert response.json() == {"month_start": "2026-08-01", "clinics": []}


def test_latest_run_404_when_empty(inventory_client, inventory_auth_headers):
    response = inventory_client.get(
        "/reporting/pipeline-runs/latest",
        headers=inventory_auth_headers,
    )
    assert response.status_code == 404


def test_manual_run_is_idempotent(inventory_client, inventory_auth_headers):
    _seed_august_events(inventory_client)

    first = inventory_client.post(
        "/reporting/pipeline-runs",
        headers=inventory_auth_headers,
        json={"month_start": "2026-08-01"},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["status"] == "completed"
    assert body["month_start"] == "2026-08-01"
    assert body["records_written"] == 2

    second = inventory_client.post(
        "/reporting/pipeline-runs",
        headers=inventory_auth_headers,
        json={"month_start": "2026-08-01"},
    )
    assert second.status_code == 200
    assert second.json()["records_written"] == 2

    kpis = inventory_client.get(
        "/reporting/monthly-clinic-supply-performance",
        headers=inventory_auth_headers,
        params={"month_start": "2026-08-01"},
    )
    assert kpis.status_code == 200
    payload = kpis.json()
    assert payload["month_start"] == "2026-08-01"
    by_clinic = {row["clinic_id"]: row for row in payload["clinics"]}
    assert by_clinic["austin-north"] == {
        "clinic_id": "austin-north",
        "country": "US",
        "total_supply_cost": 125.0,
        "supply_consumption_count": 1,
        "critical_stockout_count": 1,
        "expiry_risk_count": 1,
        "currency": "USD",
    }
    assert by_clinic["london-city"]["currency"] == "GBP"
    assert by_clinic["london-city"]["total_supply_cost"] == 24.0
    assert "total" not in payload

    again = query_monthly_clinic_supply_performance(date(2026, 8, 1))
    assert again["clinics"] == payload["clinics"]

    latest = inventory_client.get(
        "/reporting/pipeline-runs/latest",
        headers=inventory_auth_headers,
    )
    assert latest.status_code == 200
    assert latest.json()["status"] == "completed"
    assert latest.json()["records_written"] == 2
    assert latest.json()["pipeline_name"] == "monthly_clinic_supply_performance"


def test_eval_failure_does_not_abort_load(inventory_client, monkeypatch):
    _seed_august_events(inventory_client)
    monkeypatch.setenv("HEALTHCORE_EVAL_FAIL", "1")
    result = run_monthly_clinic_supply_performance(
        month_start=date(2026, 8, 1),
        allow_sample=False,
    )
    assert result["status"] == "completed"
    assert result["records_written"] == 2
