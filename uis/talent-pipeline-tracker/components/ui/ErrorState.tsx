"use client";

import { Button } from "@/components/ui/Button";

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
    <div
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      <p>{message}</p>
      {onRetry || homeHref ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {onRetry ? (
            <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {homeHref ? (
            <a href={homeHref} className="inline-flex items-center text-sm font-medium text-teal-700 underline">
              {homeLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
