import { clearToken, getToken } from "./token";

const NETWORK_ERROR_MESSAGE = "Unable to reach the server.";

export type AuthFetchObserver = {
  onUnauthorized?: (fromRoute: string) => void;
  onComplete?: (info: {
    input: RequestInfo | URL;
    method: string;
    statusCode: number;
    durationMs: number;
  }) => void;
};

let observer: AuthFetchObserver | null = null;

export function setAuthFetchObserver(next: AuthFetchObserver | null): void {
  observer = next;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const method = (init?.method ?? "GET").toUpperCase();
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  const durationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  observer?.onComplete?.({ input, method, statusCode: response.status, durationMs });

  if (response.status === 401 && typeof window !== "undefined" && token) {
    const fromRoute = `${window.location.pathname}${window.location.search}`;
    observer?.onUnauthorized?.(fromRoute.startsWith("/") ? fromRoute : `/${fromRoute}`);
    clearToken();
    const next = encodeURIComponent(fromRoute);
    window.location.href = `/login?next=${next}`;
  }

  return response;
}
