import { NextRequest, NextResponse } from "next/server";

import {
  incidentsApiUnavailableResponse,
  proxyToIncidentsApi,
} from "@/lib/api/incidents-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.text();
    const response = await proxyToIncidentsApi(request, `/api/incidents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return incidentsApiUnavailableResponse();
  }
}
