import { NextRequest, NextResponse } from "next/server";

import {
  incidentsApiUnavailableResponse,
  proxyToIncidentsApi,
} from "@/lib/api/incidents-server";

async function proxyResponse(response: Response): Promise<NextResponse> {
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.toString();
    const path = search ? `/api/incidents?${search}` : "/api/incidents";
    const response = await proxyToIncidentsApi(request, path);
    return proxyResponse(response);
  } catch {
    return incidentsApiUnavailableResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await proxyToIncidentsApi(request, "/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxyResponse(response);
  } catch {
    return incidentsApiUnavailableResponse();
  }
}
