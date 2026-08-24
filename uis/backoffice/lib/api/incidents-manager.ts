import { authFetch, parseApiError, parseApiFieldErrors } from "@healthcore/auth";
import type {
  IncidentCreateInput,
  IncidentRecord,
  IncidentSummary,
} from "@healthcore/incidents";
import type { IncidentStatus } from "@healthcore/incidents/constants";

const API_PREFIX = "/api/incidents";
const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authFetch(url, init);
  } catch {
    throw new IncidentsManagerApiError(NETWORK_ERROR, 0);
  }

  if (!response.ok) {
    throw await parseManagerError(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new IncidentsManagerApiError(INVALID_RESPONSE, response.status);
  }
}

export async function fetchManagedIncidents(filters: IncidentListFilters = {}): Promise<IncidentRecord[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.branch) params.set("branch", filters.branch);
  if (filters.category) params.set("category", filters.category);

  const query = params.toString();
  return requestJson<IncidentRecord[]>(query ? `${API_PREFIX}?${query}` : API_PREFIX);
}

export async function createManagedIncident(payload: IncidentCreateInput): Promise<IncidentRecord> {
  return requestJson<IncidentRecord>(API_PREFIX, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, status: payload.status ?? "open" }),
  });
}

export async function updateManagedIncidentStatus(
  id: number,
  status: IncidentStatus
): Promise<IncidentRecord> {
  return requestJson<IncidentRecord>(`${API_PREFIX}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function fetchIncidentSummary(): Promise<IncidentSummary> {
  return requestJson<IncidentSummary>(`${API_PREFIX}/summary`);
}
