import { authFetch, parseApiError } from "@healthcore/auth";
import { toUserFacingMessage } from "@healthcore/api/errors";

const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";
const INVALID_RESPONSE = "Received an invalid response from the server.";
const SERVER_ERROR = "An unexpected error occurred.";

export class TelemetryReportApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TelemetryReportApiError";
    this.status = status;
  }
}

export type EventsPerDayRow = {
  date: string;
  event_type: string;
  count: number;
};

export type ErrorRateByTypeRow = {
  date: string;
  event_type: string;
  errors: number;
  total: number;
  rate: number;
};

export type LatencyByDayRow = {
  date: string;
  route_template: string;
  avg_ms: number;
  count: number;
};

export type AuthFailureRateRow = {
  date: string;
  failures: number;
  attempts: number;
  rate: number;
};

export type TelemetryReport = {
  period: { from: string; to: string };
  metrics: {
    events_per_day: EventsPerDayRow[];
    error_rate_by_type: ErrorRateByTypeRow[];
    latency_by_day: LatencyByDayRow[];
    auth_failure_rate: AuthFailureRateRow[];
  };
};

export async function fetchTelemetryReport(params: {
  startDate?: string;
  endDate?: string;
}): Promise<TelemetryReport> {
  const search = new URLSearchParams();
  if (params.startDate) search.set("start_date", params.startDate);
  if (params.endDate) search.set("end_date", params.endDate);
  const query = search.toString();

  let response: Response;
  try {
    response = await authFetch(`/api/telemetry/report${query ? `?${query}` : ""}`);
  } catch (error) {
    throw new TelemetryReportApiError(toUserFacingMessage(error, NETWORK_ERROR), 0);
  }

  if (!response.ok) {
    const raw = await parseApiError(response);
    const message =
      response.status >= 500 ? toUserFacingMessage(new Error(raw), SERVER_ERROR, response.status) : raw;
    throw new TelemetryReportApiError(message, response.status);
  }

  try {
    return (await response.json()) as TelemetryReport;
  } catch {
    throw new TelemetryReportApiError(INVALID_RESPONSE, response.status);
  }
}
