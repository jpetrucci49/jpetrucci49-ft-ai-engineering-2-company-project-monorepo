"""Map a validated TelemetryEvent onto one telemetry_events row."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from telemetry.models import TelemetryEvent
from telemetry.table import TelemetryEventRow

SERVICE = "backoffice"

FORBIDDEN_TAG_KEYS = frozenset(
    {"email", "password", "token", "authorization", "description"}
)

WARN_EVENT_TYPES = frozenset(
    {
        "login_failed",
        "session_expired",
        "outbound_order_rejected",
        "inventory_validation_failed",
        "direct_stock_edit_rejected",
        "stock_threshold_triggered",
        "supply_expiry_flagged",
    }
)

PROPERTY_ALLOWLISTS: dict[str, frozenset[str]] = {
    "inbound_order_created": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "vendor_name",
            "order_id",
            "sku",
        }
    ),
    "outbound_order_created": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "department",
            "consumption_type",
            "order_id",
            "remaining_stock",
        }
    ),
    "stock_threshold_triggered": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "threshold_value",
            "threshold_kind",
            "trigger_order_type",
        }
    ),
    "direct_stock_edit_rejected": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "http_method",
            "http_status",
            "route",
        }
    ),
    "supply_expiry_flagged": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "expiry_date",
            "days_to_expiry",
            "department",
        }
    ),
    "inventory_validation_failed": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "route",
            "field",
            "error_code",
        }
    ),
    "outbound_order_rejected": frozenset(
        {
            "clinic_id",
            "country",
            "product_id",
            "product_category",
            "quantity",
            "department",
            "available",
            "requested",
            "product_name",
        }
    ),
    "catalogue_viewed": frozenset({"result_count", "out_of_stock_count", "low_stock_count"}),
    "login_failed": frozenset({"reason"}),
    "login_succeeded": frozenset({"role"}),
    "session_expired": frozenset({"from_route"}),
    "api_latency_recorded": frozenset(
        {"route_template", "method", "status_code", "duration_ms", "layer"}
    ),
    "frontend_error_uncaught": frozenset({"route", "name", "digest"}),
    "page_viewed": frozenset({"route", "referrer_route"}),
    "flow_abandoned": frozenset({"flow", "last_step", "duration_ms"}),
    "web_vital_recorded": frozenset({"name", "value", "route"}),
}


def level_for(event_type: str) -> str:
    if event_type == "frontend_error_uncaught":
        return "error"
    if event_type in WARN_EVENT_TYPES:
        return "warn"
    return "info"


def strip_properties(event_type: str, properties: dict[str, Any]) -> dict[str, Any]:
    allowed = PROPERTY_ALLOWLISTS.get(event_type, frozenset())
    stripped: dict[str, Any] = {}
    for key, value in properties.items():
        if key not in allowed or value is None:
            continue
        if key.lower() in FORBIDDEN_TAG_KEYS:
            continue
        stripped[key] = value
    return stripped


def _numeric(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        return Decimal(str(value))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def numeric_value(properties: dict[str, Any]) -> Decimal | None:
    for key in ("value", "duration_ms", "quantity"):
        parsed = _numeric(properties.get(key))
        if parsed is not None:
            return parsed
    return None


def summary_message(event: TelemetryEvent, properties: dict[str, Any]) -> str:
    if "product_id" in properties:
        return f"{event.event_type} product_id={properties['product_id']}"
    if "route" in properties:
        return f"{event.event_type} route={properties['route']}"
    return event.event_type


def build_tags(event: TelemetryEvent, properties: dict[str, Any]) -> dict[str, Any]:
    return {
        **properties,
        "eventId": event.eventId,
        "sessionId": event.sessionId,
        "userId": event.userId,
        "schemaVersion": event.schemaVersion,
        "requestId": event.requestId,
    }


def to_row(event: TelemetryEvent) -> TelemetryEventRow:
    properties = strip_properties(event.event_type, event.properties)
    return TelemetryEventRow(
        timestamp=event.timestamp,
        service=SERVICE,
        event_type=event.event_type,
        level=level_for(event.event_type),
        value=numeric_value(properties),
        message=summary_message(event, properties),
        tags=build_tags(event, properties),
    )
