import { authFetch, parseApiError, parseApiFieldErrors } from "@healthcore/auth";
import type {
  IncidentCreateInput,
  IncidentRecord,
  IncidentSummary,
} from "@healthcore/incidents";
import type { IncidentStatus } from "@healthcore/incidents/constants";

const API_PREFIX = "/api/incidents";

export class IncidentsManagerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "IncidentsManagerApiError";
  }
}

export interface IncidentListFilters {
  status?: IncidentStatus;
  origin?: IncidentCreateInput["origin"];
  branch?: IncidentCreateInput["branch"];
  category?: IncidentCreateInput["category"];
}

async function parseManagerError(response: Response): Promise<IncidentsManagerApiError> {
  const fieldErrors = await parseApiFieldErrors(response);
  const message = await parseApiError(response);
  return new IncidentsManagerApiError(message, response.status, fieldErrors);
}

export async function fetchManagedIncidents(filters: IncidentListFilters = {}): Promise<IncidentRecord[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.branch) params.set("branch", filters.branch);
  if (filters.category) params.set("category", filters.category);

  const query = params.toString();
  const response = await authFetch(query ? `${API_PREFIX}?${query}` : API_PREFIX);

  if (!response.ok) {
    throw await parseManagerError(response);
  }

  return (await response.json()) as IncidentRecord[];
}

export async function createManagedIncident(payload: IncidentCreateInput): Promise<IncidentRecord> {
  const response = await authFetch(API_PREFIX, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, status: payload.status ?? "open" }),
  });

  if (!response.ok) {
    throw await parseManagerError(response);
  }

  return (await response.json()) as IncidentRecord;
}

export async function updateManagedIncidentStatus(
  id: number,
  status: IncidentStatus
): Promise<IncidentRecord> {
  const response = await authFetch(`${API_PREFIX}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw await parseManagerError(response);
  }

  return (await response.json()) as IncidentRecord;
}

export async function fetchIncidentSummary(): Promise<IncidentSummary> {
  const response = await authFetch(`${API_PREFIX}/summary`);

  if (!response.ok) {
    throw await parseManagerError(response);
  }

  return (await response.json()) as IncidentSummary;
}
