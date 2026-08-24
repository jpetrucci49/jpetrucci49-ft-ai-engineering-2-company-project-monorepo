import { CLINICS } from "@/types/inventory";

const selectClassName = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

interface ClinicSelectProps {
  value: string;
  onChange: (clinicId: string) => void;
  disabled?: boolean;
}

export function ClinicSelect({ value, onChange, disabled }: ClinicSelectProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">Clinic</span>
      <select
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Select a clinic</option>
        {CLINICS.map((clinic) => (
          <option key={clinic.id} value={String(clinic.id)}>
            {clinic.label}
          </option>
        ))}
      </select>
    </label>
  );
}
