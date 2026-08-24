import { NextRequest } from "next/server";

import {
  proxySuppliersResponse,
  proxyToSuppliersApi,
  runSuppliersBffHandler,
} from "@/lib/api/suppliers-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return runSuppliersBffHandler(async () => {
    const { id } = await context.params;
    const body = await request.text();
    const response = await proxyToSuppliersApi(request, `/suppliers/${id}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return proxySuppliersResponse(response);
  });
}
