import { NextRequest, NextResponse } from "next/server";

import {
  incidentsApiUnavailableResponse,
  proxyToIncidentsApi,
} from "@/lib/api/incidents-server";

export async function GET(request: NextRequest) {
  try {
    const response = await proxyToIncidentsApi(request, "/api/incidents/summary");
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return incidentsApiUnavailableResponse();
  }
}
