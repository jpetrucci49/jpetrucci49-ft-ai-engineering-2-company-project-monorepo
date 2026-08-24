import { authFetch, parseApiError } from "@healthcore/auth";
import { toUserFacingMessage } from "@healthcore/api/errors";

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authFetch(url, init);
  } catch (error) {
    throw new InventoryApiError(toUserFacingMessage(error, NETWORK_ERROR), 0);
  }

  if (!response.ok) {
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
  return requestJson<MedicalSupply[]>(`${API_PREFIX}/products`);
}

export async function getSupply(id: number): Promise<MedicalSupply> {
  return requestJson<MedicalSupply>(`${API_PREFIX}/products/${id}`);
}

export async function createDelivery(payload: DeliveryCreatePayload): Promise<DeliveryRecord> {
  return requestJson<DeliveryRecord>(`${API_PREFIX}/orders/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createConsumption(payload: ConsumptionCreatePayload): Promise<ConsumptionRecord> {
  return requestJson<ConsumptionRecord>(`${API_PREFIX}/orders/outbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listMovements(): Promise<InventoryMovement[]> {
  return requestJson<InventoryMovement[]>(`${API_PREFIX}/orders`);
}
