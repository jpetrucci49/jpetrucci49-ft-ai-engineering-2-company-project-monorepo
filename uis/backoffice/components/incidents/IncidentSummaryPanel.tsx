"use client";

import { useEffect, useState } from "react";

import { fetchIncidentSummary, IncidentsManagerApiError } from "@/lib/api/incidents-manager";
import type { IncidentSummary } from "@healthcore/incidents";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  STATUS_LABELS,
} from "@healthcore/incidents/labels";

function MetricSection({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ key: string; label: string; count: number }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center justify-between gap-4">
            <span className="text-slate-700">{entry.label}</span>
            <span className="font-medium text-slate-900">{entry.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IncidentSummaryPanel() {
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchIncidentSummary();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError(
            err instanceof IncidentsManagerApiError
              ? err.message
              : "Unable to load incident summary."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading summary…</p>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => setReloadToken((value) => value + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Total incidents: {summary.total}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricSection
          title="By status"
          entries={Object.entries(summary.by_status).map(([key, count]) => ({
            key,
            label: STATUS_LABELS[key as keyof typeof STATUS_LABELS] ?? key,
            count,
          }))}
        />
        <MetricSection
          title="By category"
          entries={Object.entries(summary.by_category)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => ({
              key,
              label: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key,
              count,
            }))}
        />
        <MetricSection
          title="By origin"
          entries={Object.entries(summary.by_origin).map(([key, count]) => ({
            key,
            label: ORIGIN_LABELS[key as keyof typeof ORIGIN_LABELS] ?? key,
            count,
          }))}
        />
        <MetricSection
          title="By branch"
          entries={Object.entries(summary.by_branch)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => ({
              key,
              label: BRANCH_LABELS[key as keyof typeof BRANCH_LABELS] ?? key,
              count,
            }))}
        />
      </div>
    </div>
  );
}
