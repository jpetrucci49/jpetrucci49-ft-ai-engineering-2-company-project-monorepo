import { NextRequest } from "next/server";

import { proxyAuthResponse, proxyToAuthApi, runAuthBffHandler } from "@/lib/api/auth-server";

export async function PUT(request: NextRequest) {
  return runAuthBffHandler(async () => {
    const body = await request.text();
    const response = await proxyToAuthApi(request, "/profiles/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxyAuthResponse(response);
  });
}
