import { NextRequest } from "next/server";

import { proxyAuthResponse, runAuthBffHandler } from "@/lib/api/auth-server";
import { getFastApiOrigin } from "@healthcore/api/proxy";

export async function POST(request: NextRequest) {
  return runAuthBffHandler(async () => {
    const body = await request.text();
    const response = await fetch(`${getFastApiOrigin()}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    return proxyAuthResponse(response);
  });
}
