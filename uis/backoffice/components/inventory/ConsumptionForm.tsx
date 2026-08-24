"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ClinicSelect } from "@/components/inventory/ClinicSelect";
import { InventoryPageHeader } from "@/components/inventory/InventoryPageHeader";
import { StockBadge } from "@/components/inventory/StockBadge";
import { SupplySelect } from "@/components/inventory/SupplySelect";
import { useReloadableResource } from "@/components/inventory/useReloadableResource";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Spinner } from "@/components/ui/Spinner";
import { createConsumption, getSupply, listSupplies } from "@/lib/api/inventory";
import {
  CONSUMPTION_TYPE_LABELS,
  InventoryApiError,
  isInsufficientStockMessage,
  type ConsumptionType,
  type MedicalSupply,
} from "@/types/inventory";
import { toUserFacingMessage } from "@healthcore/api/errors";

const inputClassName = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const EMPTY_SUPPLIES: MedicalSupply[] = [];

export function ConsumptionForm() {
  const searchParams = useSearchParams();
  const querySupplyId = searchParams.get("supply_id") ?? "";

  return <ConsumptionFormFields key={querySupplyId} querySupplyId={querySupplyId} />;
}

function ConsumptionFormFields({ querySupplyId }: { querySupplyId: string }) {
  const { data: supplies, error: loadError, isLoading, retry } = useReloadableResource(
    listSupplies,
    "Unable to load medical supplies.",
    EMPTY_SUPPLIES
  );

  const [supplyId, setSupplyId] = useState(querySupplyId);
  const [selectedSupply, setSelectedSupply] = useState<MedicalSupply | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [stockEpoch, setStockEpoch] = useState(0);

  const [quantity, setQuantity] = useState("");
  const [consumptionType, setConsumptionType] = useState<ConsumptionType>("clinical_use");
  const [clinicId, setClinicId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayedSupply = selectedSupply && String(selectedSupply.id) === supplyId ? selectedSupply : null;
  const parsedQuantity = Number(quantity);
  const displayedStock = displayedSupply?.current_stock;
  const oversellWarning =
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    displayedStock !== undefined &&
    parsedQuantity > displayedStock;

  useEffect(() => {
    if (!supplyId) return;

    const id = Number(supplyId);
    if (!Number.isInteger(id)) return;

    let cancelled = false;

    async function loadStock() {
      setIsStockLoading(true);
      setStockError(null);
      try {
        const supply = await getSupply(id);
        if (!cancelled) setSelectedSupply(supply);
      } catch (error) {
        if (!cancelled) {
          setSelectedSupply(null);
          setStockError(toUserFacingMessage(error, "Unable to load current stock."));
        }
      } finally {
        if (!cancelled) setIsStockLoading(false);
      }
    }

    void loadStock();

    return () => {
      cancelled = true;
    };
  }, [supplyId, stockEpoch]);

  const keepQuerySupply = Boolean(querySupplyId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setQuantityError(null);
    setSuccessMessage(null);

    const parsedSupplyId = Number(supplyId);
    const parsedClinicId = Number(clinicId);

    if (!Number.isInteger(parsedSupplyId) || parsedSupplyId <= 0) {
      setFormError("Select a medical supply.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createConsumption({
        supply_id: parsedSupplyId,
        quantity: parsedQuantity,
        consumption_type: consumptionType,
        clinic_id: parsedClinicId,
      });
      setQuantity("");
      setConsumptionType("clinical_use");
      setClinicId("");
      if (!keepQuerySupply) setSupplyId("");
      else setStockEpoch((epoch) => epoch + 1);
      setSuccessMessage("Clinical consumption recorded. Current stock has decreased.");
    } catch (error) {
      const status = error instanceof InventoryApiError ? error.status : undefined;
      const message = toUserFacingMessage(error, "Unable to record the clinical consumption.", status);
      if (status === 400 && isInsufficientStockMessage(error instanceof Error ? error.message : "")) {
        setQuantityError(error instanceof Error ? error.message : message);
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <InventoryPageHeader
        title="Log clinical consumption"
        description="Record supplies used in patient care or discarded as expiry waste. The API rejects any quantity that would take stock below zero."
      />

      {isLoading ? <LoadingState label="Loading medical supplies…" /> : null}
      {!isLoading && loadError ? <ErrorState message={loadError} onRetry={retry} /> : null}

      {!isLoading && !loadError ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <SupplySelect
            supplies={supplies}
            value={supplyId}
            onChange={setSupplyId}
            disabled={isSubmitting}
          />

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p className="font-medium text-slate-700">Current stock</p>
            {isStockLoading ? (
              <p className="mt-1 text-slate-600">Loading current stock…</p>
            ) : stockError ? (
              <p className="mt-1 text-red-700">{stockError}</p>
            ) : displayedSupply ? (
              <div className="mt-2">
                <StockBadge currentStock={displayedSupply.current_stock} />
                <span className="ml-2 text-slate-600">{displayedSupply.unit}</span>
              </div>
            ) : (
              <p className="mt-1 text-slate-600">Select a medical supply to see current stock.</p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              step={1}
              required
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setQuantityError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={Boolean(quantityError)}
            />
            {oversellWarning && !quantityError ? (
              <span className="text-sm text-amber-800">
                Quantity exceeds current stock ({displayedStock}). You can still submit — the API will reject
                anything that would go negative.
              </span>
            ) : null}
            {quantityError ? (
              <span className="text-sm text-red-700" role="alert">
                {quantityError}
              </span>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Consumption type</span>
            <select
              className={inputClassName}
              value={consumptionType}
              onChange={(event) => setConsumptionType(event.target.value as ConsumptionType)}
              disabled={isSubmitting}
            >
              {(Object.keys(CONSUMPTION_TYPE_LABELS) as ConsumptionType[]).map((type) => (
                <option key={type} value={type}>
                  {CONSUMPTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <ClinicSelect value={clinicId} onChange={setClinicId} disabled={isSubmitting} />

          {formError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {formError}
            </p>
          ) : null}

          {successMessage ? (
            <p
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" variant="inverse" /> : null}
            {isSubmitting ? "Saving…" : "Record consumption"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
