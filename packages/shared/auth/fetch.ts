import { clearToken, getToken } from "./token";

const NETWORK_ERROR_MESSAGE = "Unable to reach the server.";

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 401 && typeof window !== "undefined") {
    clearToken();
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `/login?next=${next}`;
  }

  return response;
}
