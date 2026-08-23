import { authFetch, humanizeValidationMessage } from "@healthcore/auth";
import { AnalysisResult, IncidentsApiError } from "@/types/incidents";
import type { ApiValidationError } from "@healthcore/auth";

/** Same-origin BFF routes — proxied server-side to FastAPI (see app/api/incidents/). */
const API_PREFIX = "/api/incidents";
const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const first = payload.detail[0] as ApiValidationError;
      if (first.msg) return humanizeValidationMessage(first);
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Request failed.";
}

async function fetchIncidentsResponse(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await authFetch(url, init);
  } catch {
    throw new IncidentsApiError(NETWORK_ERROR, 0);
  }
}

export async function analyzeIncidents(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchIncidentsResponse(`${API_PREFIX}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new IncidentsApiError(message, response.status);
  }

  try {
    return (await response.json()) as AnalysisResult;
  } catch {
    throw new IncidentsApiError(INVALID_RESPONSE, response.status);
  }
}

export async function exportIncidentResults(): Promise<Blob> {
  const response = await fetchIncidentsResponse(`${API_PREFIX}/results/export`);

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new IncidentsApiError(message, response.status);
  }

  try {
    return await response.blob();
  } catch {
    throw new IncidentsApiError(INVALID_RESPONSE, response.status);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
