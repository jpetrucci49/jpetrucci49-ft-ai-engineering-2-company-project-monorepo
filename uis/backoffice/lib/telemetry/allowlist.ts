import type { TelemetryEventType } from "./types";

const ALLOWLISTS: Record<TelemetryEventType, readonly string[]> = {
  inbound_order_created: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "vendor_name",
    "order_id",
    "sku",
  ],
  outbound_order_created: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "department",
    "consumption_type",
    "order_id",
    "remaining_stock",
  ],
  stock_threshold_triggered: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "threshold_value",
    "threshold_kind",
    "trigger_order_type",
  ],
  direct_stock_edit_rejected: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "http_method",
    "http_status",
    "route",
  ],
  supply_expiry_flagged: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "expiry_date",
    "days_to_expiry",
    "department",
  ],
  inventory_validation_failed: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "route",
    "field",
    "error_code",
  ],
  outbound_order_rejected: [
    "clinic_id",
    "country",
    "product_id",
    "product_category",
    "quantity",
    "department",
    "available",
    "requested",
    "product_name",
  ],
  catalogue_viewed: ["result_count", "out_of_stock_count", "low_stock_count"],
  login_failed: ["reason"],
  login_succeeded: ["role"],
  session_expired: ["from_route"],
  api_latency_recorded: ["route_template", "method", "status_code", "duration_ms", "layer"],
  frontend_error_uncaught: ["route", "name", "digest"],
  page_viewed: ["route", "referrer_route"],
  flow_abandoned: ["flow", "last_step", "duration_ms"],
  web_vital_recorded: ["name", "value", "route"],
};

export function isKnownEventType(eventType: string): eventType is TelemetryEventType {
  return eventType in ALLOWLISTS;
}

export function stripToAllowlist(
  eventType: string,
  properties: Record<string, unknown>
): Record<string, unknown> {
  if (!isKnownEventType(eventType)) {
    return {};
  }

  const allowed = new Set(ALLOWLISTS[eventType]);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (allowed.has(key) && value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}
