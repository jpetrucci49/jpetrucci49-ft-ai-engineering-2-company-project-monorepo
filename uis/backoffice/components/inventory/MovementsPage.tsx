"use client";

import { InventoryPageHeader } from "@/components/inventory/InventoryPageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useReloadableResource } from "@/components/inventory/useReloadableResource";
import { listMovements } from "@/lib/api/inventory";
import {
  MOVEMENT_TYPE_LABELS,
  clinicLabel,
  consumptionTypeLabel,
  type InventoryMovement,
  type MovementType,
} from "@/types/inventory";

const EMPTY_MOVEMENTS: InventoryMovement[] = [];

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MovementBadge({ type }: { type: MovementType }) {
  if (type === "inbound") {
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
        {MOVEMENT_TYPE_LABELS.inbound}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900">
      {MOVEMENT_TYPE_LABELS.outbound}
    </span>
  );
}

export function MovementsPage() {
  const { data: movements, error, isLoading, retry } = useReloadableResource(
    listMovements,
    "Unable to load supply movements.",
    EMPTY_MOVEMENTS
  );

  return (
    <div className="space-y-6">
      <InventoryPageHeader
        title="Supply movements"
        description="Read-only history of vendor deliveries and clinical consumptions. Stock cannot be changed from this list."
      />

      {isLoading ? <LoadingState label="Loading supply movements…" /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={retry} /> : null}

      {!isLoading && !error && movements.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No vendor deliveries or clinical consumptions have been recorded yet.
        </p>
      ) : null}

      {!isLoading && !error && movements.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Medical supply</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Clinic</th>
                <th className="px-4 py-3">Recorded at</th>
                <th className="px-4 py-3">Logged by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((movement) => (
                <tr key={`${movement.order_type}-${movement.id}`} className="text-slate-800">
                  <td className="px-4 py-3 font-medium">{movement.supply_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{movement.sku}</td>
                  <td className="px-4 py-3">{movement.quantity}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <MovementBadge type={movement.order_type} />
                      {movement.order_type === "inbound" && movement.vendor_name ? (
                        <span className="text-xs text-slate-500">{movement.vendor_name}</span>
                      ) : null}
                      {movement.order_type === "outbound" && movement.consumption_type ? (
                        <span className="text-xs text-slate-500">
                          {consumptionTypeLabel(movement.consumption_type)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{clinicLabel(movement.clinic_id)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatRecordedAt(movement.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{movement.user_uuid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
