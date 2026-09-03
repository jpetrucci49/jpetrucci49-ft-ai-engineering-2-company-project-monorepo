from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest
from freezegun import freeze_time
from sqlmodel import Session

from inventory.database import get_engine
from telemetry.analysis import (
    auth_failure_rate,
    build_report,
    error_rate_by_type,
    events_per_day,
    latency_by_day,
    load_events,
)
from telemetry.cache import report_cache
from telemetry.period import InvalidReportPeriod, resolve_report_period
from telemetry.table import TelemetryEventRow

WINDOW_START = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc)
DAY1 = datetime(2026, 8, 31, 12, 0, tzinfo=timezone.utc)
DAY1_LATE = datetime(2026, 8, 31, 23, 0, tzinfo=timezone.utc)
DAY2 = datetime(2026, 9, 1, 1, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _clear_report_cache():
    report_cache.clear()
    yield
    report_cache.clear()


def _row(
    *,
    timestamp: datetime,
    event_type: str,
    level: str = "info",
    value: Decimal | None = None,
    tags: dict | None = None,
) -> TelemetryEventRow:
    return TelemetryEventRow(
        timestamp=timestamp,
        service="backoffice",
        event_type=event_type,
        level=level,
        value=value,
        message=event_type,
        tags=tags or {},
    )


def _seed(rows: list[TelemetryEventRow]) -> None:
    with Session(get_engine()) as session:
        session.add_all(rows)
        session.commit()


def _metric_session() -> Session:
    return Session(get_engine())


def test_events_per_day_two_types_two_days(inventory_client):
    _seed(
        [
            _row(timestamp=DAY1, event_type="page_viewed"),
            _row(timestamp=DAY1, event_type="page_viewed"),
            _row(timestamp=DAY1, event_type="login_succeeded"),
            _row(timestamp=DAY2, event_type="page_viewed"),
            _row(timestamp=DAY2, event_type="login_succeeded"),
        ]
    )
    with _metric_session() as session:
        result = events_per_day(session, WINDOW_START, WINDOW_END)
    assert result == [
        {"date": "2026-08-31", "event_type": "login_succeeded", "count": 1},
        {"date": "2026-08-31", "event_type": "page_viewed", "count": 2},
        {"date": "2026-09-01", "event_type": "login_succeeded", "count": 1},
        {"date": "2026-09-01", "event_type": "page_viewed", "count": 1},
    ]


def test_sql_window_excludes_end_and_before_start(inventory_client):
    _seed(
        [
            _row(timestamp=datetime(2026, 8, 30, 23, 0, tzinfo=timezone.utc), event_type="page_viewed"),
            _row(timestamp=DAY1, event_type="page_viewed"),
            _row(timestamp=WINDOW_END, event_type="page_viewed"),
        ]
    )
    with _metric_session() as session:
        result = events_per_day(session, WINDOW_START, WINDOW_END)
    assert result == [{"date": "2026-08-31", "event_type": "page_viewed", "count": 1}]


def test_groupby_uses_utc_calendar_day(inventory_client):
    _seed(
        [
            _row(timestamp=DAY1_LATE, event_type="page_viewed"),
            _row(timestamp=DAY2, event_type="page_viewed"),
        ]
    )
    with _metric_session() as session:
        result = events_per_day(session, WINDOW_START, WINDOW_END)
    assert [row["date"] for row in result] == ["2026-08-31", "2026-09-01"]


def test_error_rate_by_type_is_one_tenth(inventory_client):
    rows = [_row(timestamp=DAY1, event_type="page_viewed", level="info") for _ in range(9)]
    rows.append(_row(timestamp=DAY1, event_type="page_viewed", level="error"))
    _seed(rows)
    with _metric_session() as session:
        result = error_rate_by_type(session, WINDOW_START, WINDOW_END)
    assert result == [
        {"date": "2026-08-31", "event_type": "page_viewed", "errors": 1, "total": 10, "rate": 0.1}
    ]


def test_auth_failure_rate_ignores_other_types(inventory_client):
    _seed(
        [
            _row(timestamp=DAY1, event_type="login_failed", level="warn"),
            _row(timestamp=DAY1, event_type="login_succeeded"),
            _row(timestamp=DAY1, event_type="login_succeeded"),
            _row(timestamp=DAY1, event_type="login_succeeded"),
            _row(timestamp=DAY1, event_type="page_viewed"),
        ]
    )
    with _metric_session() as session:
        loaded = load_events(
            session, WINDOW_START, WINDOW_END, event_types=("login_failed", "login_succeeded")
        )
        result = auth_failure_rate(session, WINDOW_START, WINDOW_END)
    assert set(loaded["event_type"]) == {"login_failed", "login_succeeded"}
    assert result == [{"date": "2026-08-31", "failures": 1, "attempts": 4, "rate": 0.25}]


def test_latency_mean_drops_rows_without_value(inventory_client):
    _seed(
        [
            _row(
                timestamp=DAY1,
                event_type="api_latency_recorded",
                value=Decimal("10"),
                tags={"route_template": "/api/inventory/products", "duration_ms": 10},
            ),
            _row(
                timestamp=DAY1,
                event_type="api_latency_recorded",
                value=Decimal("30"),
                tags={"route_template": "/api/inventory/products", "duration_ms": 30},
            ),
            _row(
                timestamp=DAY1,
                event_type="api_latency_recorded",
                tags={"route_template": "/api/inventory/products"},
            ),
            _row(
                timestamp=DAY1,
                event_type="api_latency_recorded",
                value=Decimal("99"),
                tags={"duration_ms": 99},
            ),
        ]
    )
    with _metric_session() as session:
        result = latency_by_day(session, WINDOW_START, WINDOW_END)
    assert result == [
        {
            "date": "2026-08-31",
            "route_template": "/api/inventory/products",
            "avg_ms": 20.0,
            "count": 2,
        }
    ]


def test_empty_window_returns_empty_lists(inventory_client):
    with _metric_session() as session:
        report = build_report(session, WINDOW_START, WINDOW_END)
    assert report["metrics"] == {
        "events_per_day": [],
        "error_rate_by_type": [],
        "latency_by_day": [],
        "auth_failure_rate": [],
    }


def test_metric_functions_are_side_effect_free(inventory_client):
    _seed([_row(timestamp=DAY1, event_type="page_viewed")])
    with _metric_session() as session:
        first = events_per_day(session, WINDOW_START, WINDOW_END)
        second = events_per_day(session, WINDOW_START, WINDOW_END)
    assert first == second


def test_resolve_period_defaults_and_rejects_inverted_range():
    now = datetime(2026, 9, 2, 14, 3, tzinfo=timezone.utc)
    start, end = resolve_report_period(None, None, now=now)
    assert start == datetime(2026, 8, 26, 14, 3, tzinfo=timezone.utc)
    assert end == now
    with pytest.raises(InvalidReportPeriod):
        resolve_report_period("2026-09-02", "2026-09-01")
    with pytest.raises(InvalidReportPeriod):
        resolve_report_period("not-a-date", None)


def test_report_requires_auth(inventory_client):
    response = inventory_client.get("/telemetry/report")
    assert response.status_code == 401


@freeze_time("2026-09-02T14:03:00+00:00")
def test_report_default_window_and_keys(inventory_client, inventory_auth_headers):
    response = inventory_client.get("/telemetry/report", headers=inventory_auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["from"].startswith("2026-08-26T14:03:00")
    assert body["period"]["to"].startswith("2026-09-02T14:03:00")
    assert set(body["metrics"]) == {
        "events_per_day",
        "error_rate_by_type",
        "latency_by_day",
        "auth_failure_rate",
    }


def test_report_explicit_window_filters_rows(inventory_client, inventory_auth_headers):
    _seed(
        [
            _row(timestamp=DAY1, event_type="page_viewed"),
            _row(timestamp=DAY2, event_type="login_succeeded"),
        ]
    )
    response = inventory_client.get(
        "/telemetry/report",
        params={"start_date": "2026-08-31T00:00:00Z", "end_date": "2026-09-01T00:00:00Z"},
        headers=inventory_auth_headers,
    )
    assert response.status_code == 200
    types = {row["event_type"] for row in response.json()["metrics"]["events_per_day"]}
    assert types == {"page_viewed"}


def test_report_cache_computes_once_within_ttl(inventory_client, inventory_auth_headers):
    calls = {"n": 0}
    real = __import__("telemetry.analysis", fromlist=["build_report"]).build_report

    def _counting_build(session, start, end):
        calls["n"] += 1
        return real(session, start, end)

    with patch("telemetry.router.build_report", side_effect=_counting_build):
        first = inventory_client.get(
            "/telemetry/report",
            params={"start_date": "2026-08-31", "end_date": "2026-09-02"},
            headers=inventory_auth_headers,
        )
        second = inventory_client.get(
            "/telemetry/report",
            params={"start_date": "2026-08-31", "end_date": "2026-09-02"},
            headers=inventory_auth_headers,
        )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert calls["n"] == 1


def test_report_cache_misses_after_ttl(inventory_client, inventory_auth_headers, monkeypatch):
    monkeypatch.setattr(report_cache, "ttl_seconds", 0)
    calls = {"n": 0}
    real = __import__("telemetry.analysis", fromlist=["build_report"]).build_report

    def _counting_build(session, start, end):
        calls["n"] += 1
        return real(session, start, end)

    with patch("telemetry.router.build_report", side_effect=_counting_build):
        inventory_client.get(
            "/telemetry/report",
            params={"start_date": "2026-08-31", "end_date": "2026-09-02"},
            headers=inventory_auth_headers,
        )
        inventory_client.get(
            "/telemetry/report",
            params={"start_date": "2026-08-31", "end_date": "2026-09-02"},
            headers=inventory_auth_headers,
        )
    assert calls["n"] == 2


def test_report_rejects_bad_and_inverted_dates(inventory_client, inventory_auth_headers):
    bad = inventory_client.get(
        "/telemetry/report",
        params={"start_date": "nope"},
        headers=inventory_auth_headers,
    )
    inverted = inventory_client.get(
        "/telemetry/report",
        params={"start_date": "2026-09-02", "end_date": "2026-09-01"},
        headers=inventory_auth_headers,
    )
    assert bad.status_code == 400
    assert inverted.status_code == 400
