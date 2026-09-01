import { LOW_STOCK_MAX } from "@/types/inventory";

import { EXPIRY_WINDOW_DAYS } from "./constants";
import type { Department, ProductCategory } from "./types";

const DEPARTMENTS: readonly Department[] = [
  "general_consultation",
  "chronic_care",
  "specialty_care",
  "chronic_disease_management",
  "pharmacy",
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  general_consultation: "General consultation",
  chronic_care: "Chronic care",
  specialty_care: "Specialty care",
  chronic_disease_management: "Chronic disease management",
  pharmacy: "Pharmacy",
};

export function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as readonly string[]).includes(value);
}

export function countryFromClinicId(clinicId: number): "US" | "UK" {
  return clinicId >= 10 ? "UK" : "US";
}

export function toProductCategory(apiCategory: string): ProductCategory {
  if (apiCategory === "ppe") return "ppe";
  if (apiCategory === "medications" || apiCategory === "medication") return "medication";
  if (apiCategory === "equipment") return "equipment";
  return "consumable";
}

export function countryFromSupply(country: string, clinicId?: number): "US" | "UK" {
  if (country === "US" || country === "UK") return country;
  if (clinicId !== undefined) return countryFromClinicId(clinicId);
  return "US";
}

export function thresholdForRemaining(remaining: number): {
  threshold_kind: "low" | "out";
  threshold_value: number;
} | null {
  if (remaining <= 0) return { threshold_kind: "out", threshold_value: 0 };
  if (remaining <= LOW_STOCK_MAX) return { threshold_kind: "low", threshold_value: LOW_STOCK_MAX };
  return null;
}

export interface ExpiringSupplyInput {
  id: number;
  category: string;
  country: string;
  current_stock: number;
  expiry_date?: string;
}

export interface ExpiringSupplyProperties {
  country: "US" | "UK";
  product_id: number;
  product_category: ProductCategory;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Pure scanner. Does not invent dates — skips supplies without expiry_date. */
export function collectExpiringSupplies(
  supplies: readonly ExpiringSupplyInput[],
  now: Date = new Date()
): ExpiringSupplyProperties[] {
  const today = startOfUtcDay(now);
  const flagged: ExpiringSupplyProperties[] = [];

  for (const supply of supplies) {
    if (!supply.expiry_date || supply.current_stock <= 0) continue;

    const expiry = Date.parse(`${supply.expiry_date}T00:00:00.000Z`);
    if (Number.isNaN(expiry)) continue;

    const days = Math.round((expiry - today) / 86_400_000);
    if (days < 0 || days > EXPIRY_WINDOW_DAYS) continue;

    flagged.push({
      country: countryFromSupply(supply.country),
      product_id: supply.id,
      product_category: toProductCategory(supply.category),
      quantity: supply.current_stock,
      expiry_date: supply.expiry_date,
      days_to_expiry: days,
    });
  }

  return flagged;
}

export function parseInsufficientStock(message: string): {
  product_name?: string;
  available: number;
  requested: number;
} | null {
  if (!message.startsWith("Insufficient stock for supply")) return null;
  const availableMatch = message.match(/Available:\s*(\d+)/);
  const requestedMatch = message.match(/requested:\s*(\d+)/);
  if (!availableMatch || !requestedMatch) return null;
  const nameMatch = message.match(/supply '([^']+)'/);
  return {
    product_name: nameMatch?.[1],
    available: Number(availableMatch[1]),
    requested: Number(requestedMatch[1]),
  };
}
