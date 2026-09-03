import { NextRequest } from "next/server";

import {
  proxyInventoryResponse,
  proxyToInventoryApi,
  runInventoryBffHandler,
} from "@/lib/api/inventory-server";

export async function GET(request: NextRequest) {
  return runInventoryBffHandler(async () => {
    const query = request.nextUrl.search;
    const response = await proxyToInventoryApi(request, `/telemetry/report${query}`);
    return proxyInventoryResponse(response);
  });
}
