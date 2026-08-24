import { NextResponse } from "next/server";

import { isInvalidJsonBodyError, isNetworkFailure, sanitizeApiDetail } from "@healthcore/api/errors";

/** Proxy an upstream FastAPI response with sanitized JSON error bodies. */
export async function proxySanitizedResponse(response: Response): Promise<NextResponse> {
  const contentType = response.headers.get("Content-Type") ?? "application/json";
  const body = await response.text();

  if (contentType.includes("application/json") && body) {
    try {
      const payload = JSON.parse(body) as { detail?: unknown };
      if (payload.detail !== undefined) {
        payload.detail = sanitizeApiDetail(payload.detail);
      }
      return NextResponse.json(payload, {
        status: response.status,
        headers: { "Content-Type": contentType },
      });
    } catch {
      // Fall through to raw body when JSON parsing fails.
    }
  }

  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

export function invalidRequestBodyResponse(): NextResponse {
  return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
}

/**
 * Run a BFF handler with scoped error handling:
 * - SyntaxError → 400 invalid body
 * - TypeError (network) → 502 unavailable
 */
export async function runBffHandler(
  unavailableResponse: () => NextResponse,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (isInvalidJsonBodyError(error)) {
      return invalidRequestBodyResponse();
    }
    if (isNetworkFailure(error)) {
      return unavailableResponse();
    }
    throw error;
  }
}
