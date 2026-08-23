/** Strip Pydantic `input` / `ctx` fields from validation error payloads. */
export function sanitizeApiDetail(detail: unknown): unknown {
  if (typeof detail === "string") {
    return detail;
  }

  if (!Array.isArray(detail)) {
    return detail;
  }

  return detail.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const entry = item as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    if ("loc" in entry) safe.loc = entry.loc;
    if ("msg" in entry) safe.msg = entry.msg;
    if ("type" in entry) safe.type = entry.type;
    return safe;
  });
}

export function isInvalidJsonBodyError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

const TECHNICAL_MESSAGE =
  /unexpected token|syntaxerror|json\.parse|network|fetch failed|failed to fetch|econnrefused|enotfound/i;

/** Map API / network errors to human-readable UI copy. */
export function toUserFacingMessage(
  error: unknown,
  fallback: string,
  status?: number
): string {
  if (status !== undefined && status >= 500) {
    return fallback;
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message || TECHNICAL_MESSAGE.test(message)) {
    return fallback;
  }

  return message;
}
