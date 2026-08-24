import { authFetch, humanizeValidationMessage } from "@healthcore/auth";
import type { ApiValidationError } from "@healthcore/auth";
import {
  Supplier,
  SupplierCreatePayload,
  SupplierListFilters,
  SupplierRateUpdatePayload,
  SupplierStatusUpdatePayload,
  SuppliersApiError,
} from "@/types/suppliers";

const API_PREFIX = "/api/suppliers";
const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const first = payload.detail[0] as ApiValidationError;
      if (first.msg) return humanizeValidationMessage(first);
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Request failed.";
}

function buildQuery(filters?: SupplierListFilters): string {
  const params = new URLSearchParams();
  if (filters?.country) params.set("country", filters.country);
  if (filters?.category) params.set("category", filters.category);
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authFetch(url, init);
  } catch {
    throw new SuppliersApiError(NETWORK_ERROR, 0);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new SuppliersApiError(message, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SuppliersApiError(INVALID_RESPONSE, response.status);
  }
}

export async function fetchSuppliers(filters?: SupplierListFilters): Promise<Supplier[]> {
  return requestJson<Supplier[]>(`${API_PREFIX}${buildQuery(filters)}`);
}

export async function createSupplier(payload: SupplierCreatePayload): Promise<Supplier> {
  return requestJson<Supplier>(API_PREFIX, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSupplierRate(
  id: number,
  payload: SupplierRateUpdatePayload
): Promise<Supplier> {
  return requestJson<Supplier>(`${API_PREFIX}/${id}/rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSupplierStatus(
  id: number,
  payload: SupplierStatusUpdatePayload
): Promise<Supplier> {
  return requestJson<Supplier>(`${API_PREFIX}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function formatRate(rate: number, currency: string): string {
  return `${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function sortSuppliersByName(suppliers: Supplier[]): Supplier[] {
  return [...suppliers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
