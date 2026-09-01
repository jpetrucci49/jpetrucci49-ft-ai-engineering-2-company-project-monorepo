import { authFetch, parseApiError } from "@healthcore/auth";
import { toUserFacingMessage } from "@healthcore/api/errors";

import {
  collectExpiringSupplies,
  countryFromClinicId,
  parseInsufficientStock,
  thresholdForRemaining,
  toProductCategory,
} from "@/lib/telemetry/mapInventory";
import { track } from "@/lib/telemetry";
import {
  InventoryApiError,
  type ConsumptionCreatePayload,
  type ConsumptionRecord,
  type DeliveryCreatePayload,
  type DeliveryRecord,
  type InventoryMovement,
  type MedicalSupply,
} from "@/types/inventory";

const API_PREFIX = "/api/inventory";
const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";
const SERVER_ERROR = "An unexpected error occurred.";

export type ConsumptionTelemetry = {
  department: string;
  apiCategory?: string;
};

function maybeTrackDirectStockReject(url: string, init: RequestInit | undefined, status: number): void {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "PATCH" && method !== "PUT" && method !== "DELETE") return;
  if (!url.includes("/products/")) return;
  if (status < 400 || status > 499) return;

  const idMatch = url.match(/\/products\/(\d+)/);
  track("direct_stock_edit_rejected", {
    http_method: method,
    http_status: status,
    route: `/inventory/products/${idMatch?.[1] ?? ""}`,
    product_id: idMatch ? Number(idMatch[1]) : undefined,
  });
}

function flagExpiringSupplies(supplies: readonly MedicalSupply[]): void {
  for (const item of collectExpiringSupplies(supplies)) {
    track("supply_expiry_flagged", { ...item });
  }
}

function trackThreshold(args: {
  clinicId: number;
  productId: number;
  category: string;
  remaining: number;
  trigger: "inbound" | "outbound";
}): void {
  const band = thresholdForRemaining(args.remaining);
  if (!band) return;
  track("stock_threshold_triggered", {
    clinic_id: args.clinicId,
    country: countryFromClinicId(args.clinicId),
    product_id: args.productId,
    product_category: toProductCategory(args.category),
    quantity: args.remaining,
    threshold_value: band.threshold_value,
    threshold_kind: band.threshold_kind,
    trigger_order_type: args.trigger,
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authFetch(url, init);
  } catch (error) {
    throw new InventoryApiError(toUserFacingMessage(error, NETWORK_ERROR), 0);
  }

  if (!response.ok) {
    maybeTrackDirectStockReject(url, init, response.status);
    const raw = await parseApiError(response);
    const message =
      response.status >= 500 ? toUserFacingMessage(new Error(raw), SERVER_ERROR, response.status) : raw;
    throw new InventoryApiError(message, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new InventoryApiError(INVALID_RESPONSE, response.status);
  }
}

export async function listSupplies(): Promise<MedicalSupply[]> {
  const supplies = await requestJson<MedicalSupply[]>(`${API_PREFIX}/products`);
  flagExpiringSupplies(supplies);
  return supplies;
}

export async function getSupply(id: number): Promise<MedicalSupply> {
  const supply = await requestJson<MedicalSupply>(`${API_PREFIX}/products/${id}`);
  flagExpiringSupplies([supply]);
  return supply;
}

export async function createDelivery(payload: DeliveryCreatePayload): Promise<DeliveryRecord> {
  try {
    const record = await requestJson<DeliveryRecord>(`${API_PREFIX}/orders/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    track("inbound_order_created", {
      clinic_id: record.clinic_id,
      country: countryFromClinicId(record.clinic_id),
      product_id: record.supply_id,
      product_category: toProductCategory(record.supply.category),
      quantity: record.quantity,
      vendor_name: record.vendor_name,
      order_id: record.id,
      sku: record.supply.sku,
    });

    try {
      const remaining = await getSupply(record.supply_id);
      trackThreshold({
        clinicId: record.clinic_id,
        productId: record.supply_id,
        category: remaining.category,
        remaining: remaining.current_stock,
        trigger: "inbound",
      });
    } catch {
      // Order already recorded; threshold is best-effort.
    }

    return record;
  } catch (error) {
    if (error instanceof InventoryApiError && error.status === 400) {
      track("inventory_validation_failed", {
        route: "/inventory/orders/inbound",
        error_code: "validation_error",
        clinic_id: payload.clinic_id,
        product_id: payload.supply_id,
        quantity: payload.quantity,
        country: countryFromClinicId(payload.clinic_id),
      });
    }
    throw error;
  }
}

export async function createConsumption(
  payload: ConsumptionCreatePayload,
  telemetry?: ConsumptionTelemetry
): Promise<ConsumptionRecord> {
  try {
    const record = await requestJson<ConsumptionRecord>(`${API_PREFIX}/orders/outbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let remainingStock: number | undefined;
    try {
      const remaining = await getSupply(record.supply_id);
      remainingStock = remaining.current_stock;
      trackThreshold({
        clinicId: record.clinic_id,
        productId: record.supply_id,
        category: remaining.category,
        remaining: remaining.current_stock,
        trigger: "outbound",
      });
    } catch {
      // Order already recorded; remaining stock is optional.
    }

    track("outbound_order_created", {
      clinic_id: record.clinic_id,
      country: countryFromClinicId(record.clinic_id),
      product_id: record.supply_id,
      product_category: toProductCategory(record.supply.category),
      quantity: record.quantity,
      department: telemetry?.department,
      consumption_type: record.consumption_type,
      order_id: record.id,
      remaining_stock: remainingStock,
    });

    return record;
  } catch (error) {
    if (error instanceof InventoryApiError && error.status === 400) {
      const parsed = parseInsufficientStock(error.message);
      if (parsed) {
        track("outbound_order_rejected", {
          clinic_id: payload.clinic_id,
          country: countryFromClinicId(payload.clinic_id),
          product_id: payload.supply_id,
          product_category: telemetry?.apiCategory
            ? toProductCategory(telemetry.apiCategory)
            : undefined,
          quantity: payload.quantity,
          department: telemetry?.department,
          available: parsed.available,
          requested: parsed.requested,
          product_name: parsed.product_name,
        });
      } else {
        track("inventory_validation_failed", {
          route: "/inventory/orders/outbound",
          error_code: "validation_error",
          clinic_id: payload.clinic_id,
          product_id: payload.supply_id,
          quantity: payload.quantity,
          country: countryFromClinicId(payload.clinic_id),
        });
      }
    }
    throw error;
  }
}

export async function listMovements(): Promise<InventoryMovement[]> {
  return requestJson<InventoryMovement[]>(`${API_PREFIX}/orders`);
}

/** Triggers the rejected direct-stock path (API has no stock PATCH). Not used by UI. */
export async function requestDirectStockEdit(productId: number): Promise<void> {
  await requestJson<unknown>(`${API_PREFIX}/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}
