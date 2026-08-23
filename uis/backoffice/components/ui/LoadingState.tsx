import { Spinner } from "@/components/ui/Spinner";

interface LoadingStateProps {
  label: string;
  layout?: "splash" | "fullscreen" | "inline";
  className?: string;
}

export function LoadingState({ label, layout = "splash", className = "" }: LoadingStateProps) {
  if (layout === "inline") {
    return <Spinner label={label} />;
  }

  const body = (
    <>
      <Spinner size="lg" />
      <p className="mt-4 text-sm font-medium text-slate-700">{label}</p>
    </>
  );

  if (layout === "fullscreen") {
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 ${className}`}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-10 shadow-sm ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {body}
    </div>
  );
}
