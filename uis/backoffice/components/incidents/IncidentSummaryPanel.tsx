"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchIncidentSummary, IncidentsManagerApiError } from "@/lib/api/incidents-manager";
import type { IncidentSummary } from "@healthcore/incidents";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  STATUS_LABELS,
} from "@healthcore/incidents/labels";

import { LoadingState } from "@/components/ui/LoadingState";

type SummaryFilterParam = "status" | "category" | "origin" | "branch";

function buildManageUrl(filterParam: SummaryFilterParam, value: string): string {
  const params = new URLSearchParams();
  params.set(filterParam, value);
  return `/incidents/manage?${params.toString()}`;
}

function MetricSection({
  title,
  entries,
  filterParam,
  onNavigate,
}: {
  title: string;
  entries: Array<{ key: string; label: string; count: number }>;
  filterParam: SummaryFilterParam;
  onNavigate: (href: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {entries.map((entry) => {
          const isInteractive = entry.count > 0;

          return (
            <li key={entry.key}>
              <button
                type="button"
                disabled={!isInteractive}
                className={`flex w-full items-center justify-between gap-4 rounded-md px-2 py-1.5 text-left transition-colors ${
                  isInteractive
                    ? "cursor-pointer hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    : "cursor-default text-slate-400"
                }`}
                onClick={() => {
                  if (isInteractive) onNavigate(buildManageUrl(filterParam, entry.key));
                }}
              >
                <span className={isInteractive ? "text-slate-700" : "text-slate-400"}>{entry.label}</span>
                <span className={`font-medium ${isInteractive ? "text-slate-900" : "text-slate-400"}`}>
                  {entry.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function IncidentSummaryPanel() {
  const router = useRouter();
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

  function navigateToList(href: string) {
    router.push(href);
  }

  if (isLoading) {
    return <LoadingState label="Loading summary…" />;
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
      <button
        type="button"
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        onClick={() => navigateToList("/incidents/manage")}
      >
        Total incidents: <span className="font-semibold text-slate-900">{summary.total}</span>
        <span className="ml-2 text-blue-700 underline">View all</span>
      </button>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricSection
          title="By status"
          filterParam="status"
          onNavigate={navigateToList}
          entries={Object.entries(summary.by_status).map(([key, count]) => ({
            key,
            label: STATUS_LABELS[key as keyof typeof STATUS_LABELS] ?? key,
            count,
          }))}
        />
        <MetricSection
          title="By category"
          filterParam="category"
          onNavigate={navigateToList}
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
          filterParam="origin"
          onNavigate={navigateToList}
          entries={Object.entries(summary.by_origin).map(([key, count]) => ({
            key,
            label: ORIGIN_LABELS[key as keyof typeof ORIGIN_LABELS] ?? key,
            count,
          }))}
        />
        <MetricSection
          title="By branch"
          filterParam="branch"
          onNavigate={navigateToList}
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
