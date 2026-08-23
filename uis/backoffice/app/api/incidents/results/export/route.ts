import { NextRequest, NextResponse } from "next/server";

import { proxyToIncidentsApi, runIncidentsBffHandler } from "@/lib/api/incidents-server";

export async function GET(request: NextRequest) {
  return runIncidentsBffHandler(async () => {
    const response = await proxyToIncidentsApi(request, "/api/incidents/results/export");
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/csv",
        "Content-Disposition":
          response.headers.get("Content-Disposition") ?? 'attachment; filename="results.csv"',
      },
    });
  });
}
