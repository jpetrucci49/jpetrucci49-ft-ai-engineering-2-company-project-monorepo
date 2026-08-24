export type SupplyCategory = "ppe" | "wound_care" | "diagnostics" | "medications" | "consumables";
export type SupplyCountry = "US" | "UK";
export type ConsumptionType = "clinical_use" | "expiry_waste";
export type MovementType = "inbound" | "outbound";
export type StockLevel = "out" | "low" | "healthy";

export interface MedicalSupply {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  country: string;
  current_stock: number;
}

export interface SupplySummary {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  country: string;
}

export interface DeliveryCreatePayload {
  supply_id: number;
  quantity: number;
  vendor_name: string;
  clinic_id: number;
}

export interface DeliveryRecord {
  id: number;
  supply_id: number;
  quantity: number;
  vendor_name: string;
  clinic_id: number;
  created_at: string;
  user_uuid: string;
  supply: SupplySummary;
}

export interface ConsumptionCreatePayload {
  supply_id: number;
  quantity: number;
  consumption_type: ConsumptionType;
  clinic_id: number;
}

export interface ConsumptionRecord {
  id: number;
  supply_id: number;
  quantity: number;
  consumption_type: string;
  clinic_id: number;
  created_at: string;
  user_uuid: string;
  supply: SupplySummary;
}

export interface InventoryMovement {
  order_type: MovementType;
  id: number;
  supply_id: number;
  supply_name: string;
  sku: string;
  quantity: number;
  clinic_id: number;
  created_at: string;
  user_uuid: string;
  vendor_name: string | null;
  consumption_type: string | null;
}

export class InventoryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "InventoryApiError";
  }
}

export const SUPPLY_CATEGORIES = [
  "ppe",
  "wound_care",
  "diagnostics",
  "medications",
  "consumables",
] as const satisfies readonly SupplyCategory[];

export const CATEGORY_LABELS: Record<SupplyCategory, string> = {
  ppe: "PPE",
  wound_care: "Wound care",
  diagnostics: "Diagnostics",
  medications: "Medications",
  consumables: "Consumables",
};

export const CONSUMPTION_TYPE_LABELS: Record<ConsumptionType, string> = {
  clinical_use: "Clinical use",
  expiry_waste: "Expiry waste",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  inbound: "Vendor delivery",
  outbound: "Clinical consumption",
};

export const CLINICS = [
  { id: 1, label: "Austin Main" },
  { id: 2, label: "Austin North" },
  { id: 3, label: "Dallas Uptown" },
  { id: 4, label: "Houston Medical Center" },
  { id: 5, label: "San Antonio West" },
  { id: 6, label: "Miami Brickell" },
  { id: 7, label: "Orlando East" },
  { id: 8, label: "Tampa Bay" },
  { id: 9, label: "Atlanta Midtown" },
  { id: 10, label: "London City" },
  { id: 11, label: "London West" },
  { id: 12, label: "Manchester Central" },
] as const;

export const CLINIC_LABELS: Record<number, string> = Object.fromEntries(
  CLINICS.map((clinic) => [clinic.id, clinic.label])
);

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as SupplyCategory] ?? category;
}

export function clinicLabel(clinicId: number): string {
  return CLINIC_LABELS[clinicId] ?? `Clinic ${clinicId}`;
}

export function consumptionTypeLabel(value: string): string {
  return CONSUMPTION_TYPE_LABELS[value as ConsumptionType] ?? value;
}

export function isInsufficientStockMessage(message: string): boolean {
  return message.startsWith("Insufficient stock for supply");
}

// Out of stock: 0 (red). Low: 1–10 (amber) — restock before the next clinic shift.
// Healthy: > 10 (green). Thresholds are UX-only; the API still enforces non-negative stock.
export const LOW_STOCK_MAX = 10;

export function stockLevel(currentStock: number): StockLevel {
  if (currentStock <= 0) return "out";
  if (currentStock <= LOW_STOCK_MAX) return "low";
  return "healthy";
}

export function stockLevelLabel(level: StockLevel): string {
  if (level === "out") return "Out of stock";
  if (level === "low") return "Low stock";
  return "Healthy";
}
