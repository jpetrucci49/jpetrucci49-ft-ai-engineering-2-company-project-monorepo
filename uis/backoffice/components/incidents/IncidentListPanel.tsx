"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  fetchManagedIncidents,
  IncidentsManagerApiError,
  updateManagedIncidentStatus,
  type IncidentListFilters,
} from "@/lib/api/incidents-manager";
import {
  INCIDENT_BRANCHES,
  INCIDENT_ORIGINS,
  INCIDENT_STATUSES,
  type IncidentBranch,
  type IncidentOrigin,
  type IncidentRecord,
  type IncidentStatus,
} from "@healthcore/incidents";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  STATUS_LABELS,
} from "@healthcore/incidents/labels";
import { getAllowedNextStatuses } from "@healthcore/incidents/lifecycle";

function readFilters(searchParams: URLSearchParams): IncidentListFilters {
  const filters: IncidentListFilters = {};

  const status = searchParams.get("status");
  if (status && INCIDENT_STATUSES.includes(status as IncidentStatus)) {
    filters.status = status as IncidentStatus;
  }

  const origin = searchParams.get("origin");
  if (origin && INCIDENT_ORIGINS.includes(origin as IncidentOrigin)) {
    filters.origin = origin as IncidentOrigin;
  }

  const branch = searchParams.get("branch");
  if (branch && INCIDENT_BRANCHES.includes(branch as IncidentBranch)) {
    filters.branch = branch as IncidentBranch;
  }

  return filters;
}

export function IncidentListPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusErrors, setStatusErrors] = useState<Record<number, string>>({});

  const loadIncidents = useCallback(async (activeFilters: IncidentListFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchManagedIncidents(activeFilters);
      setIncidents(data);
    } catch (err) {
      setIncidents([]);
      setError(
        err instanceof IncidentsManagerApiError
          ? err.message
          : "Unable to load incidents."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents(filters);
  }, [filters, loadIncidents]);

  function updateFilters(next: IncidentListFilters) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.origin) params.set("origin", next.origin);
    if (next.branch) params.set("branch", next.branch);
    router.replace(params.toString() ? `?${params.toString()}` : "/incidents/manage");
  }

  async function handleStatusChange(incident: IncidentRecord, nextStatus: IncidentStatus) {
    const previousStatus = incident.status;
    setIncidents((current) =>
      current.map((item) => (item.id === incident.id ? { ...item, status: nextStatus } : item))
    );
    setStatusErrors((current) => {
      const copy = { ...current };
      delete copy[incident.id];
      return copy;
    });

    try {
      const updated = await updateManagedIncidentStatus(incident.id, nextStatus);
      setIncidents((current) =>
        current.map((item) => (item.id === incident.id ? updated : item))
      );
    } catch (err) {
      setIncidents((current) =>
        current.map((item) => (item.id === incident.id ? { ...item, status: previousStatus } : item))
      );
      setStatusErrors((current) => ({
        ...current,
        [incident.id]:
          err instanceof IncidentsManagerApiError
            ? err.message
            : "Unable to update status.",
      }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filters.status ?? ""}
            onChange={(event) =>
              updateFilters({ ...filters, status: (event.target.value || undefined) as IncidentStatus | undefined })
            }
          >
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filters.origin ?? ""}
            onChange={(event) =>
              updateFilters({ ...filters, origin: (event.target.value || undefined) as IncidentOrigin | undefined })
            }
          >
            <option value="">All origins</option>
            {INCIDENT_ORIGINS.map((origin) => (
              <option key={origin} value={origin}>
                {ORIGIN_LABELS[origin]}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filters.branch ?? ""}
            onChange={(event) =>
              updateFilters({ ...filters, branch: (event.target.value || undefined) as IncidentBranch | undefined })
            }
          >
            <option value="">All branches</option>
            {INCIDENT_BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {BRANCH_LABELS[branch]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-600">Loading incidents…</p> : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => void loadIncidents(filters)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && incidents.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No incidents match the current filters.
        </p>
      ) : null}

      {!isLoading && !error && incidents.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Origin</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => {
                const options = [incident.status, ...getAllowedNextStatuses(incident.status)];
                return (
                  <tr key={incident.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{incident.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{incident.description.slice(0, 100)}…</p>
                    </td>
                    <td className="px-4 py-3">{CATEGORY_LABELS[incident.category]}</td>
                    <td className="px-4 py-3">{ORIGIN_LABELS[incident.origin]}</td>
                    <td className="px-4 py-3">{BRANCH_LABELS[incident.branch]}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        value={incident.status}
                        onChange={(event) =>
                          void handleStatusChange(incident, event.target.value as IncidentStatus)
                        }
                      >
                        {options.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      {statusErrors[incident.id] ? (
                        <p className="mt-1 text-xs text-red-600">{statusErrors[incident.id]}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
