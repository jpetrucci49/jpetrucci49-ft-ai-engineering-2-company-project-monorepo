"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full bg-slate-50 p-8 text-slate-900 antialiased">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-600">
          An unexpected error occurred. Please try again or return to the pipeline.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
            onClick={() => reset()}
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Return home
          </a>
        </div>
      </body>
    </html>
  );
}
