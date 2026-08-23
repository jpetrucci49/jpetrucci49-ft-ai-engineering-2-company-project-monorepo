import { ApiError } from "@/types/api";
import { humanizeValidationMessage } from "@healthcore/auth";
import type { ApiValidationError } from "@healthcore/auth";

const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";
const CONFIG_ERROR = "The application is not configured correctly. Contact your administrator.";

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError(CONFIG_ERROR, 0);
  }
  return baseUrl.replace(/\/$/, "");
}

function buildUrl(path: string, searchParams?: URLSearchParams): string {
  const url = `${getBaseUrl()}${path}`;
  if (!searchParams || [...searchParams.keys()].length === 0) return url;
  return `${url}?${searchParams.toString()}`;
}

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

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, searchParams), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(INVALID_RESPONSE, response.status);
  }
}
