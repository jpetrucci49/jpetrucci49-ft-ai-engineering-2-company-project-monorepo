import { stripToAllowlist } from "./allowlist";
import {
  ERROR_DEDUPE_MS,
  FLUSH_INTERVAL_MS,
  LATENCY_ALWAYS_MS,
  LATENCY_SAMPLE_RATE,
  MAX_QUEUE,
  MAX_RETRIES,
  RETRY_BASE_MS,
  SCHEMA_VERSION,
  SESSION_STORAGE_KEY,
  THRESHOLD_THROTTLE_MS,
} from "./constants";
import type { TelemetryBatch, TelemetryEvent } from "./types";

let queue: TelemetryEvent[] = [];
let userId: string | null = null;
let sessionId: string | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let sending = false;
let missingEndpointWarned = false;

const pageViewedRoutes = new Set<string>();
const expiryFlaggedProducts = new Set<number>();
const webVitalsSeen = new Set<string>();
const errorDedupe = new Map<string, number>();
const thresholdDedupe = new Map<string, { at: number; quantity: number }>();

function endpoint(): string {
  return process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT?.trim() ?? "";
}

function warnIfUnconfigured(): void {
  if (endpoint() || missingEndpointWarned) return;
  missingEndpointWarned = true;
  if (process.env.NODE_ENV !== "production") {
    console.warn("NEXT_PUBLIC_TELEMETRY_ENDPOINT is unset; telemetry track() is a no-op.");
  }
}

function newId(): string {
  return crypto.randomUUID();
}

export function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      sessionId = stored;
      return stored;
    }
  }
  const created = newId();
  sessionId = created;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  }
  return created;
}

export function setTelemetryUser(nextUserId: string | null): void {
  userId = nextUserId;
}

function shouldDrop(eventType: string, properties: Record<string, unknown>): boolean {
  if (eventType === "page_viewed") {
    const route = String(properties.route ?? "");
    if (!route || pageViewedRoutes.has(route)) return true;
    pageViewedRoutes.add(route);
    return false;
  }

  if (eventType === "web_vital_recorded") {
    const key = `${properties.name}:${properties.route}`;
    if (webVitalsSeen.has(key)) return true;
    webVitalsSeen.add(key);
    return false;
  }

  if (eventType === "supply_expiry_flagged") {
    const productId = Number(properties.product_id);
    if (!Number.isFinite(productId) || expiryFlaggedProducts.has(productId)) return true;
    expiryFlaggedProducts.add(productId);
    return false;
  }

  if (eventType === "frontend_error_uncaught") {
    const key = `${properties.route}|${properties.name}|${properties.digest ?? ""}`;
    const now = Date.now();
    const previous = errorDedupe.get(key);
    if (previous !== undefined && now - previous < ERROR_DEDUPE_MS) return true;
    errorDedupe.set(key, now);
    return false;
  }

  if (eventType === "stock_threshold_triggered") {
    const key = `${properties.product_id}:${properties.threshold_kind}`;
    const quantity = Number(properties.quantity);
    const now = Date.now();
    const previous = thresholdDedupe.get(key);
    if (previous && now - previous.at < THRESHOLD_THROTTLE_MS && previous.quantity === quantity) {
      return true;
    }
    thresholdDedupe.set(key, { at: now, quantity });
    return false;
  }

  if (eventType === "api_latency_recorded") {
    const duration = Number(properties.duration_ms);
    if (duration >= LATENCY_ALWAYS_MS) return false;
    return Math.random() >= LATENCY_SAMPLE_RATE;
  }

  return false;
}

function enqueue(event: TelemetryEvent): void {
  queue.push(event);
  if (queue.length >= MAX_QUEUE) {
    void flush();
  }
}

async function sendWithRetry(batch: TelemetryEvent[], url: string): Promise<boolean> {
  const payload: TelemetryBatch = { events: batch };
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: attempt === MAX_RETRIES,
      });
      if (response.ok) return true;
    } catch {
      // Retry below.
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * 2 ** attempt));
    }
  }
  return false;
}

export async function flush(): Promise<void> {
  const url = endpoint();
  if (!url || sending || queue.length === 0) return;

  sending = true;
  const batch = queue;
  queue = [];
  try {
    const ok = await sendWithRetry(batch, url);
    if (!ok) {
      // Spec: discard after retries. Do not re-queue.
    }
  } finally {
    sending = false;
  }
}

export function flushOnHide(): void {
  const url = endpoint();
  if (!url || queue.length === 0) return;

  const batch = queue;
  queue = [];
  const body = JSON.stringify({ events: batch } satisfies TelemetryBatch);
  const blob = new Blob([body], { type: "application/json" });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(url, blob);
    if (queued) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Tab is hiding; nothing further to do.
  });
}

export function startFlushTimer(): void {
  if (flushTimer !== null || typeof window === "undefined") return;
  flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
}

export function track(eventType: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  warnIfUnconfigured();
  if (!endpoint()) return;

  const stripped = stripToAllowlist(eventType, properties);
  if (shouldDrop(eventType, stripped)) return;

  enqueue({
    eventId: newId(),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    userId,
    event_type: eventType,
    schemaVersion: SCHEMA_VERSION,
    requestId: newId(),
    properties: stripped,
  });
}
