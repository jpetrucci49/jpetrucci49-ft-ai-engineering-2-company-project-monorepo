import { Suspense } from "react";

import { IncidentListPanel } from "@/components/incidents/IncidentListPanel";
import { LoadingState } from "@/components/ui/LoadingState";

export default function IncidentManagePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Incident list</h1>
      <Suspense fallback={<LoadingState label="Loading filters…" />}>
        <IncidentListPanel />
      </Suspense>
    </div>
  );
}
