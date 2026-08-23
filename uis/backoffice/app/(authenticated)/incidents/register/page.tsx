import { IncidentRegisterForm } from "@/components/incidents/IncidentRegisterForm";

export default function IncidentRegisterPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Register incident</h1>
      <IncidentRegisterForm />
    </div>
  );
}
