"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { initTelemetry, track } from "@/lib/telemetry";

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousRoute = useRef<string | null>(null);

  useEffect(() => {
    initTelemetry();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const route = pathname.startsWith("/") ? pathname : `/${pathname}`;
    track("page_viewed", {
      route,
      referrer_route: previousRoute.current,
    });
    previousRoute.current = route;
  }, [pathname]);

  return children;
}
