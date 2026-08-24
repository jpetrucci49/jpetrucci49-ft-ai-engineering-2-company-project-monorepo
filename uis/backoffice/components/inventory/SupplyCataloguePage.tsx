"use client";

import Link from "next/link";

import { InventoryPageHeader } from "@/components/inventory/InventoryPageHeader";
import { StockBadge } from "@/components/inventory/StockBadge";
import { useReloadableResource } from "@/components/inventory/useReloadableResource";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { listSupplies } from "@/lib/api/inventory";
import { categoryLabel, type MedicalSupply } from "@/types/inventory";

const EMPTY_SUPPLIES: MedicalSupply[] = [];

export function SupplyCataloguePage() {
  const { data: supplies, error, isLoading, retry } = useReloadableResource(
    listSupplies,
    "Unable to load medical supplies.",
    EMPTY_SUPPLIES
  );

  return (
    <div className="space-y-6">
      <InventoryPageHeader
        title="Medical supplies"
        description="Network-wide catalogue. Current stock is the net of vendor deliveries minus clinical consumptions — it cannot be edited directly."
      />

      {isLoading ? <LoadingState label="Loading medical supplies…" /> : null}

      {!isLoading && error ? <ErrorState message={error} onRetry={retry} /> : null}

      {!isLoading && !error && supplies.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No medical supplies in the catalogue.
        </p>
      ) : null}

      {!isLoading && !error && supplies.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3">Current stock</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplies.map((supply) => (
                <tr key={supply.id} className="text-slate-800">
                  <td className="px-4 py-3 font-medium">{supply.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{supply.sku}</td>
                  <td className="px-4 py-3">{categoryLabel(supply.category)}</td>
                  <td className="px-4 py-3">{supply.unit}</td>
                  <td className="px-4 py-3">{supply.country}</td>
                  <td className="px-4 py-3">
                    <StockBadge currentStock={supply.current_stock} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                      <Link
                        className="text-sky-700 underline hover:text-sky-900"
                        href={`/inventory/orders/inbound?supply_id=${supply.id}`}
                      >
                        Log vendor delivery
                      </Link>
                      <Link
                        className="text-sky-700 underline hover:text-sky-900"
                        href={`/inventory/orders/outbound?supply_id=${supply.id}`}
                      >
                        Log clinical consumption
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
