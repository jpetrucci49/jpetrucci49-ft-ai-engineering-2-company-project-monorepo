import { NextRequest } from "next/server";

import {
  proxyIncidentsResponse,
  proxyToIncidentsApi,
  runIncidentsBffHandler,
} from "@/lib/api/incidents-server";

export async function GET(request: NextRequest) {
  return runIncidentsBffHandler(async () => {
    const response = await proxyToIncidentsApi(request, "/api/incidents/summary");
    return proxyIncidentsResponse(response);
  });
}
