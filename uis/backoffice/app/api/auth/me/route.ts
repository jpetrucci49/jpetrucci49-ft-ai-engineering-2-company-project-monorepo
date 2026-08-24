import { NextRequest } from "next/server";

import { proxyAuthResponse, proxyToAuthApi, runAuthBffHandler } from "@/lib/api/auth-server";

export async function GET(request: NextRequest) {
  return runAuthBffHandler(async () => {
    const response = await proxyToAuthApi(request, "/auth/me");
    return proxyAuthResponse(response);
  });
}
