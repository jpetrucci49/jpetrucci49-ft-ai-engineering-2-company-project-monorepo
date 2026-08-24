import { Suspense } from "react";

import { DeliveryForm } from "@/components/inventory/DeliveryForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function InventoryInboundPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading vendor delivery form…" />}>
      <DeliveryForm />
    </Suspense>
  );
}
