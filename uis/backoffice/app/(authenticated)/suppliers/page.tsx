import { Suspense } from "react";

import { SupplierDirectoryPage } from "@/components/suppliers/SupplierDirectoryPage";
import { LoadingState } from "@/components/ui/LoadingState";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading suppliers…" />}>
      <SupplierDirectoryPage />
    </Suspense>
  );
}
