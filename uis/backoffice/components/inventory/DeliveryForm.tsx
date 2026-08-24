"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ClinicSelect } from "@/components/inventory/ClinicSelect";
import { InventoryPageHeader } from "@/components/inventory/InventoryPageHeader";
import { SupplySelect } from "@/components/inventory/SupplySelect";
import { useReloadableResource } from "@/components/inventory/useReloadableResource";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Spinner } from "@/components/ui/Spinner";
import { createDelivery, listSupplies } from "@/lib/api/inventory";
import { InventoryApiError, type MedicalSupply } from "@/types/inventory";
import { toUserFacingMessage } from "@healthcore/api/errors";

const inputClassName = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const EMPTY_SUPPLIES: MedicalSupply[] = [];

export function DeliveryForm() {
  const searchParams = useSearchParams();
  const querySupplyId = searchParams.get("supply_id") ?? "";

  return <DeliveryFormFields key={querySupplyId} querySupplyId={querySupplyId} />;
}

function DeliveryFormFields({ querySupplyId }: { querySupplyId: string }) {
  const { data: supplies, error: loadError, isLoading, retry } = useReloadableResource(
    listSupplies,
    "Unable to load medical supplies.",
    EMPTY_SUPPLIES
  );

  const [supplyId, setSupplyId] = useState(querySupplyId);
  const [quantity, setQuantity] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const keepQuerySupply = Boolean(querySupplyId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const parsedSupplyId = Number(supplyId);
    const parsedQuantity = Number(quantity);
    const parsedClinicId = Number(clinicId);

    if (!Number.isInteger(parsedSupplyId) || parsedSupplyId <= 0) {
      setFormError("Select a medical supply.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createDelivery({
        supply_id: parsedSupplyId,
        quantity: parsedQuantity,
        vendor_name: vendorName.trim(),
        clinic_id: parsedClinicId,
      });
      setQuantity("");
      setVendorName("");
      setClinicId("");
      if (!keepQuerySupply) setSupplyId("");
      setSuccessMessage("Vendor delivery recorded. Current stock has increased.");
    } catch (error) {
      const status = error instanceof InventoryApiError ? error.status : undefined;
      setFormError(toUserFacingMessage(error, "Unable to record the vendor delivery.", status));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <InventoryPageHeader
        title="Log vendor delivery"
        description="Record a shipment received at a HealthCore clinic. Stock increases only through deliveries."
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

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              step={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Vendor</span>
            <input
              className={inputClassName}
              type="text"
              required
              maxLength={200}
              value={vendorName}
              onChange={(event) => setVendorName(event.target.value)}
              disabled={isSubmitting}
              placeholder="MedLine Industries"
            />
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
            {isSubmitting ? "Saving…" : "Record delivery"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
