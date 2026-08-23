import { NextRequest } from "next/server";

import {
  proxyIncidentsResponse,
  proxyToIncidentsApi,
  runIncidentsBffHandler,
} from "@/lib/api/incidents-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return runIncidentsBffHandler(async () => {
    const { id } = await context.params;
    const body = await request.text();
    const response = await proxyToIncidentsApi(request, `/api/incidents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxyIncidentsResponse(response);
  });
}
