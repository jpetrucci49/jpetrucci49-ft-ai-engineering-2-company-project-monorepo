import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { forwardAuthorization } from "@healthcore/api/proxy";
import { proxySanitizedResponse, runBffHandler } from "@/lib/api/bff-proxy";

export const INVENTORY_API_UNAVAILABLE =
  "Unable to reach the inventory API. Ensure it is running (npm run dev:api on port 8000).";

export function getInventoryApiOrigin(): string {
  return (process.env.INVENTORY_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export function inventoryApiUnavailableResponse(): NextResponse {
  return NextResponse.json({ detail: INVENTORY_API_UNAVAILABLE }, { status: 502 });
}

export async function proxyToInventoryApi(
  request: NextRequest,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = forwardAuthorization(request.headers.get("authorization"), init?.headers);
  return fetch(`${getInventoryApiOrigin()}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
}

export function proxyInventoryResponse(response: Response): Promise<NextResponse> {
  return proxySanitizedResponse(response);
}

export function runInventoryBffHandler(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return runBffHandler(inventoryApiUnavailableResponse, handler);
}
