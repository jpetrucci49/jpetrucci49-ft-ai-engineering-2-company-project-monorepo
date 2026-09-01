export type TelemetryEventType =
  | "inbound_order_created"
  | "outbound_order_created"
  | "stock_threshold_triggered"
  | "direct_stock_edit_rejected"
  | "supply_expiry_flagged"
  | "inventory_validation_failed"
  | "outbound_order_rejected"
  | "catalogue_viewed"
  | "login_failed"
  | "login_succeeded"
  | "session_expired"
  | "api_latency_recorded"
  | "frontend_error_uncaught"
  | "page_viewed"
  | "flow_abandoned"
  | "web_vital_recorded";

export type ProductCategory = "medication" | "ppe" | "consumable" | "equipment";

export type Department =
  | "general_consultation"
  | "chronic_care"
  | "specialty_care"
  | "chronic_disease_management"
  | "pharmacy";

export type LoginFailureReason = "invalid_credentials" | "inactive" | "malformed" | "network_error";

export interface TelemetryEvent {
  eventId: string;
  timestamp: string;
  sessionId: string;
  userId: string | null;
  event_type: string;
  schemaVersion: string;
  requestId: string;
  properties: Record<string, unknown>;
}

export interface TelemetryBatch {
  events: TelemetryEvent[];
}
