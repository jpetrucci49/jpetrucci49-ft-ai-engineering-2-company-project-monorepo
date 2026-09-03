"use client";

import { FormEvent, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useReloadableResource } from "@/components/inventory/useReloadableResource";
import { fetchTelemetryReport, type TelemetryReport } from "@/lib/api/telemetry";

const EMPTY_REPORT: TelemetryReport | null = null;

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function MetricTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-800">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                {headers.map((header) => (
                  <th key={header} className="px-2 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, index) => (
                <tr key={`${title}-${index}`} className="border-b border-slate-100 last:border-0">
                  {cells.map((cell, cellIndex) => (
                    <td key={`${title}-${index}-${cellIndex}`} className="px-2 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TelemetryReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("start_date") ?? "";
  const endDate = searchParams.get("end_date") ?? "";

  const load = useCallback(
    () =>
      fetchTelemetryReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    [startDate, endDate]
  );

  const { data: report, error, isLoading, retry } = useReloadableResource<TelemetryReport | null>(
    load,
    "Unable to load the telemetry report.",
    EMPTY_REPORT
  );

  function applyWindow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextStart = String(form.get("start_date") ?? "").trim();
    const nextEnd = String(form.get("end_date") ?? "").trim();
    const next = new URLSearchParams();
    if (nextStart) next.set("start_date", nextStart);
    if (nextEnd) next.set("end_date", nextEnd);
    const query = next.toString();
    router.push(query ? `/telemetry?${query}` : "/telemetry");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Telemetry health</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operational volume, errors, API latency, and login failures for the Digital platform.
        </p>
      </div>

      <form
        key={`${startDate}|${endDate}`}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={applyWindow}
      >
        <label className="text-sm text-slate-700">
          Start
          <input
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1 text-slate-900"
            type="date"
            name="start_date"
            defaultValue={startDate}
          />
        </label>
        <label className="text-sm text-slate-700">
          End
          <input
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1 text-slate-900"
            type="date"
            name="end_date"
            defaultValue={endDate}
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply window
        </button>
      </form>

      {report ? (
        <p className="text-sm text-slate-700">
          Period from <span className="font-medium">{report.period.from}</span> to{" "}
          <span className="font-medium">{report.period.to}</span> (UTC, exclusive end).
        </p>
      ) : null}

      {isLoading ? <LoadingState label="Loading telemetry report…" /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={retry} homeHref="/" /> : null}

      {!isLoading && report ? (
        <div className="grid gap-4">
          <MetricTable
            title="Events per day"
            empty="No events in this window."
            headers={["Date", "Event type", "Count"]}
            rows={report.metrics.events_per_day.map((row) => [row.date, row.event_type, String(row.count)])}
          />
          <MetricTable
            title="Error rate by type"
            empty="No events in this window."
            headers={["Date", "Event type", "Errors", "Total", "Rate"]}
            rows={report.metrics.error_rate_by_type.map((row) => [
              row.date,
              row.event_type,
              String(row.errors),
              String(row.total),
              formatRate(row.rate),
            ])}
          />
          <MetricTable
            title="API latency"
            empty="No api_latency_recorded events in this window."
            headers={["Date", "Route", "Avg ms", "Samples"]}
            rows={report.metrics.latency_by_day.map((row) => [
              row.date,
              row.route_template,
              row.avg_ms.toFixed(1),
              String(row.count),
            ])}
          />
          <MetricTable
            title="Login failure rate"
            empty="No login attempts in this window."
            headers={["Date", "Failures", "Attempts", "Rate"]}
            rows={report.metrics.auth_failure_rate.map((row) => [
              row.date,
              String(row.failures),
              String(row.attempts),
              formatRate(row.rate),
            ])}
          />
        </div>
      ) : null}
    </div>
  );
}
