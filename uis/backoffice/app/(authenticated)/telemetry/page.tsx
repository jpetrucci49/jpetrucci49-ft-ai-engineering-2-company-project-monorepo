import { Suspense } from "react";

import { TelemetryReportPage } from "@/components/telemetry/TelemetryReportPage";
import { LoadingState } from "@/components/ui/LoadingState";

export default function TelemetryPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading telemetry…" />}>
      <TelemetryReportPage />
    </Suspense>
  );
}
