interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "inverse";
}

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
} as const;

const VARIANT_CLASSES = {
  default: "border-slate-300 border-t-slate-900",
  inverse: "border-white/40 border-t-white",
} as const;

export function Spinner({ label, size = "md", variant = "default" }: SpinnerProps) {
  const spinner = (
    <span
      className={`inline-block animate-spin rounded-full border-2 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`}
      aria-hidden="true"
    />
  );

  if (!label) {
    return spinner;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600" role="status" aria-live="polite">
      {spinner}
      <span>{label}</span>
    </div>
  );
}
