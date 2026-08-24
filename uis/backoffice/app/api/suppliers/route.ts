import { NextRequest } from "next/server";

import {
  proxySuppliersResponse,
  proxyToSuppliersApi,
  runSuppliersBffHandler,
} from "@/lib/api/suppliers-server";

export async function GET(request: NextRequest) {
  return runSuppliersBffHandler(async () => {
    const search = request.nextUrl.searchParams.toString();
    const path = search ? `/suppliers?${search}` : "/suppliers";
    const response = await proxyToSuppliersApi(request, path);
    return proxySuppliersResponse(response);
  });
}

export async function POST(request: NextRequest) {
  return runSuppliersBffHandler(async () => {
    const body = await request.text();
    const response = await proxyToSuppliersApi(request, "/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxySuppliersResponse(response);
  });
}
