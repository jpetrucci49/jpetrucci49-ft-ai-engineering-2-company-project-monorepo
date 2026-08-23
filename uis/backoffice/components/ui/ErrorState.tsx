"use client";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  homeHref?: string;
  homeLabel?: string;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
  homeHref,
  homeLabel = "Return home",
}: ErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p>{message}</p>
      {onRetry || homeHref ? (
        <div className="mt-3 flex flex-wrap gap-4">
          {onRetry ? (
            <button type="button" className="font-medium underline hover:no-underline" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {homeHref ? (
            <a href={homeHref} className="font-medium underline hover:no-underline">
              {homeLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
