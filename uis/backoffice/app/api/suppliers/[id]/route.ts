import { NextRequest, NextResponse } from "next/server";

import {
  proxySuppliersResponse,
  proxyToSuppliersApi,
  runSuppliersBffHandler,
} from "@/lib/api/suppliers-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  return runSuppliersBffHandler(async () => {
    const { id } = await context.params;
    const response = await proxyToSuppliersApi(request, `/suppliers/${id}`, { method: "DELETE" });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return proxySuppliersResponse(response);
  });
}
