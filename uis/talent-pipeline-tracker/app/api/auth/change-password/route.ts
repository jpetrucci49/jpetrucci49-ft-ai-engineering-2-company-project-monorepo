import { NextRequest } from "next/server";

import { proxyAuthResponse, proxyToAuthApi, runAuthBffHandler } from "@/lib/api/auth-server";

export async function POST(request: NextRequest) {
  return runAuthBffHandler(async () => {
    const body = await request.text();
    const response = await proxyToAuthApi(request, "/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxyAuthResponse(response);
  });
}
