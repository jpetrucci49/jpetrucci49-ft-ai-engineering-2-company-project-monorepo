import { IncidentSummaryPanel } from "@/components/incidents/IncidentSummaryPanel";

export default function IncidentSummaryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Incident summary</h1>
      <IncidentSummaryPanel />
    </div>
  );
}
