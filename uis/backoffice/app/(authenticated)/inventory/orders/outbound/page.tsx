import { Suspense } from "react";

import { ConsumptionForm } from "@/components/inventory/ConsumptionForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function InventoryOutboundPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading clinical consumption form…" />}>
      <ConsumptionForm />
    </Suspense>
  );
}
