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
  INCIDENT_CATEGORIES,
  INCIDENT_ORIGINS,
  INCIDENT_STATUSES,
  type IncidentBranch,
  type IncidentCategory,
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

import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

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

  const category = searchParams.get("category");
  if (category && INCIDENT_CATEGORIES.includes(category as IncidentCategory)) {
    filters.category = category as IncidentCategory;
  }

  return filters;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function IncidentDetailModal({
  incident,
  onClose,
  onStatusChange,
  statusError,
}: {
  incident: IncidentRecord;
  onClose: () => void;
  onStatusChange: (incident: IncidentRecord, nextStatus: IncidentStatus) => void;
  statusError?: string;
}) {
  const options = [incident.status, ...getAllowedNextStatuses(incident.status)];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close incident details"
        onClick={onClose}
      />

      <section
        className="relative z-10 max-h-[90vh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="incident-detail-title" className="text-lg font-semibold text-slate-900">
            Incident details
          </h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="font-medium text-slate-700">Title</dt>
            <dd className="mt-1 break-words text-slate-900">{incident.title}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="font-medium text-slate-700">Description</dt>
            <dd className="mt-1 min-w-0 break-words whitespace-pre-wrap text-slate-900">
              {incident.description}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Category</dt>
            <dd className="mt-1 text-slate-900">{CATEGORY_LABELS[incident.category]}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Origin</dt>
            <dd className="mt-1 text-slate-900">{ORIGIN_LABELS[incident.origin]}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Branch</dt>
            <dd className="mt-1 text-slate-900">{BRANCH_LABELS[incident.branch]}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Status</dt>
            <dd className="mt-1">
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={incident.status}
                onChange={(event) =>
                  void onStatusChange(incident, event.target.value as IncidentStatus)
                }
              >
                {options.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {statusError ? <p className="mt-1 text-xs text-red-600">{statusError}</p> : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Created</dt>
            <dd className="mt-1 text-slate-900">{formatTimestamp(incident.created_at)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Last updated</dt>
            <dd className="mt-1 text-slate-900">{formatTimestamp(incident.updated_at)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export function IncidentListPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusErrors, setStatusErrors] = useState<Record<number, string>>({});
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

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

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId]
  );

  useEffect(() => {
    if (selectedIncidentId !== null && !selectedIncident) {
      setSelectedIncidentId(null);
    }
  }, [selectedIncident, selectedIncidentId]);

  function updateFilters(next: IncidentListFilters) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.origin) params.set("origin", next.origin);
    if (next.branch) params.set("branch", next.branch);
    if (next.category) params.set("category", next.category);
    router.replace(
      params.toString() ? `/incidents/manage?${params.toString()}` : "/incidents/manage"
    );
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
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status:</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Origin:</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Branch:</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          </label>
        </div>
      </div>

      {isLoading ? <LoadingState label="Loading incidents…" /> : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void loadIncidents(filters)} homeHref="/" />
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
                <th className="w-44 px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => {
                const options = [incident.status, ...getAllowedNextStatuses(incident.status)];
                const isSelected = selectedIncidentId === incident.id;
                const preview =
                  incident.description.length > 100
                    ? `${incident.description.slice(0, 100)}…`
                    : incident.description;

                return (
                  <tr
                    key={incident.id}
                    className={`cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-slate-50 ${
                      isSelected ? "bg-blue-50 hover:bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedIncidentId(incident.id)}
                  >
                    <td className="min-w-0 max-w-md px-4 py-3">
                      <p className="break-words font-medium text-slate-900">{incident.title}</p>
                      <p className="mt-1 break-words text-xs text-slate-500">{preview}</p>
                    </td>
                    <td className="px-4 py-3">{CATEGORY_LABELS[incident.category]}</td>
                    <td className="px-4 py-3">{ORIGIN_LABELS[incident.origin]}</td>
                    <td className="px-4 py-3">{BRANCH_LABELS[incident.branch]}</td>
                    <td className="w-44 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <select
                        className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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

      {selectedIncident ? (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncidentId(null)}
          onStatusChange={handleStatusChange}
          statusError={statusErrors[selectedIncident.id]}
        />
      ) : null}
    </div>
  );
}
