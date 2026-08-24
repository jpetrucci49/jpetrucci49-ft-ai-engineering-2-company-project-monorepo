import {
  stockLevel,
  stockLevelLabel,
  type StockLevel,
} from "@/types/inventory";

const LEVEL_STYLES: Record<StockLevel, string> = {
  out: "bg-red-100 text-red-800",
  low: "bg-amber-100 text-amber-900",
  healthy: "bg-emerald-100 text-emerald-800",
};

export function StockBadge({ currentStock }: { currentStock: number }) {
  const level = stockLevel(currentStock);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}>
      <span aria-hidden className="font-semibold">
        {currentStock}
      </span>
      <span>{stockLevelLabel(level)}</span>
    </span>
  );
}
