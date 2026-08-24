import { NextRequest } from "next/server";

import {
  proxyIncidentsResponse,
  proxyToIncidentsApi,
  runIncidentsBffHandler,
} from "@/lib/api/incidents-server";

export async function POST(request: NextRequest) {
  return runIncidentsBffHandler(async () => {
    const formData = await request.formData();
    const response = await proxyToIncidentsApi(request, "/api/incidents/analyze", {
      method: "POST",
      body: formData,
    });
    return proxyIncidentsResponse(response);
  });
}
