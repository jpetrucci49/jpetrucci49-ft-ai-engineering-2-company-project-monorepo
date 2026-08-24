import { NextRequest, NextResponse } from "next/server";

import {
  proxyInventoryResponse,
  proxyToInventoryApi,
  runInventoryBffHandler,
} from "@/lib/api/inventory-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return runInventoryBffHandler(async () => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ detail: "Supply not found." }, { status: 404 });
    }
    const response = await proxyToInventoryApi(request, `/inventory/products/${id}`);
    return proxyInventoryResponse(response);
  });
}
