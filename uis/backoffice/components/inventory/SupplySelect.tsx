import type { MedicalSupply } from "@/types/inventory";

const selectClassName = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

interface SupplySelectProps {
  supplies: MedicalSupply[];
  value: string;
  onChange: (supplyId: string) => void;
  disabled?: boolean;
}

export function SupplySelect({ supplies, value, onChange, disabled }: SupplySelectProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">Medical supply</span>
      <select
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Select a medical supply</option>
        {supplies.map((supply) => (
          <option key={supply.id} value={String(supply.id)}>
            {supply.name} ({supply.sku})
          </option>
        ))}
      </select>
    </label>
  );
}
