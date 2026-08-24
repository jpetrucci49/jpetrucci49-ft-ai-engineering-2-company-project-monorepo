import { NextRequest } from "next/server";

import {
  proxyIncidentsResponse,
  proxyToIncidentsApi,
  runIncidentsBffHandler,
} from "@/lib/api/incidents-server";

export async function GET(request: NextRequest) {
  return runIncidentsBffHandler(async () => {
    const search = request.nextUrl.searchParams.toString();
    const path = search ? `/api/incidents?${search}` : "/api/incidents";
    const response = await proxyToIncidentsApi(request, path);
    return proxyIncidentsResponse(response);
  });
}

export async function POST(request: NextRequest) {
  return runIncidentsBffHandler(async () => {
    const body = await request.text();
    const response = await proxyToIncidentsApi(request, "/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxyIncidentsResponse(response);
  });
}
