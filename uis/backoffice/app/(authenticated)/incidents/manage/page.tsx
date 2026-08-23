import { Suspense } from "react";

import { IncidentListPanel } from "@/components/incidents/IncidentListPanel";

export default function IncidentManagePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Incident list</h1>
      <Suspense fallback={<p className="text-sm text-slate-600">Loading filters…</p>}>
        <IncidentListPanel />
      </Suspense>
    </div>
  );
}
