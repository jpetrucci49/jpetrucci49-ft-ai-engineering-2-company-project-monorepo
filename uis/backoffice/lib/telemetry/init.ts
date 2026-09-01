import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

import { getToken, setAuthFetchObserver } from "@healthcore/auth";

import { flushOnHide, getSessionId, setTelemetryUser, startFlushTimer, track } from "./service";

let started = false;

function currentRoute(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;
  return path.startsWith("/") ? path : `/${path}`;
}

function routeTemplate(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname : String(input);
  const path = raw.split("?")[0] ?? "/";
  return path.replace(/\/\d+(?=\/|$)/g, "/{id}");
}

function telemetryUrl(): string {
  return process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT?.trim() ?? "";
}

function isTelemetryRequest(input: RequestInfo | URL): boolean {
  const url = telemetryUrl();
  if (!url) return false;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
  return raw.includes("/telemetry/events");
}

function staffIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

function reportVital(metric: Metric): void {
  track("web_vital_recorded", {
    name: metric.name,
    value: metric.value,
    route: currentRoute(),
  });
}

function onWindowError(event: ErrorEvent): void {
  track("frontend_error_uncaught", {
    route: currentRoute(),
    name: event.error instanceof Error ? event.error.name : "Error",
  });
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const name = reason instanceof Error ? reason.name : "UnhandledRejection";
  track("frontend_error_uncaught", {
    route: currentRoute(),
    name,
  });
}

function onVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    flushOnHide();
  }
}

export function initTelemetry(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  getSessionId();
  const token = getToken();
  if (token) {
    setTelemetryUser(staffIdFromToken(token));
  }

  startFlushTimer();
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  onCLS(reportVital);
  onINP(reportVital);
  onLCP(reportVital);
  onFCP(reportVital);
  onTTFB(reportVital);

  setAuthFetchObserver({
    onUnauthorized(fromRoute) {
      track("session_expired", { from_route: fromRoute.split("?")[0] || "/" });
    },
    onComplete({ input, method, statusCode, durationMs }) {
      if (isTelemetryRequest(input)) return;
      track("api_latency_recorded", {
        route_template: routeTemplate(input),
        method,
        status_code: statusCode,
        duration_ms: durationMs,
        layer: "bff",
      });
    },
  });
}
