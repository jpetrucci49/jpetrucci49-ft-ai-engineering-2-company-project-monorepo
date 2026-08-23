import { NextRequest, NextResponse } from "next/server";

import { forwardAuthorization, getFastApiOrigin } from "@healthcore/api/proxy";
import { proxySanitizedResponse, runBffHandler } from "@/lib/api/bff-proxy";

export const AUTH_API_UNAVAILABLE =
  "Unable to reach the authentication API. Ensure it is running (npm run dev:api on port 8000).";

export function authApiUnavailableResponse(): NextResponse {
  return NextResponse.json({ detail: AUTH_API_UNAVAILABLE }, { status: 502 });
}

export async function proxyAuthResponse(response: Response): Promise<NextResponse> {
  return proxySanitizedResponse(response);
}

export async function proxyToAuthApi(
  request: NextRequest,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = forwardAuthorization(request.headers.get("authorization"), init?.headers);
  return fetch(`${getFastApiOrigin()}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
}

export function runAuthBffHandler(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return runBffHandler(authApiUnavailableResponse, handler);
}
