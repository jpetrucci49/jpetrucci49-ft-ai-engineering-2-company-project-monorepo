"use client";

import type { ApiValidationError } from "./types";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  category: "Category",
  origin: "Origin",
  branch: "Branch",
  status: "Status",
  email: "Email",
  password: "Password",
  name: "Name",
  phone: "Phone",
  address: "Address",
  token: "Reset token",
  new_password: "New password",
  current_password: "Current password",
  monthly_rate: "Monthly rate",
  categories: "Categories",
  country: "Country",
  currency: "Currency",
  contact_email: "Contact email",
};

const SKIP_LOC_PARTS = new Set(["body", "query", "path", "header", "cookie"]);

function fieldLabel(loc: ApiValidationError["loc"]): string | null {
  for (let index = loc.length - 1; index >= 0; index -= 1) {
    const part = loc[index];
    if (typeof part === "string" && !SKIP_LOC_PARTS.has(part)) {
      return FIELD_LABELS[part] ?? part.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }
  return null;
}

function messageNamesField(label: string, message: string): boolean {
  return message.toLowerCase().includes(label.toLowerCase());
}

function replaceGenericSubject(message: string, label: string): string {
  if (message.startsWith("String ")) {
    return `${label}${message.slice(6)}`;
  }
  if (message.startsWith("Input ")) {
    return `${label}${message.slice(5)}`;
  }
  return message;
}

export function humanizeValidationMessage(item: ApiValidationError): string {
  const label = fieldLabel(item.loc);
  const message = item.msg ?? "Request failed.";

  if (!label) {
    return message;
  }

  if (messageNamesField(label, message) && item.type !== "string_too_short") {
    return message;
  }

  if (item.type === "missing") {
    return `${label} is required.`;
  }

  if (item.type === "string_too_short" || item.type === "string_too_long") {
    return replaceGenericSubject(message, label);
  }

  if (item.type === "greater_than") {
    const match = message.match(/greater than ([0-9.]+)/i);
    return `${label} must be greater than ${match?.[1] ?? "0"}.`;
  }

  if (item.type === "enum" || item.type === "enum_type" || item.type === "literal_error") {
    return `${label} has an invalid value.`;
  }

  if (message.startsWith("value is not a valid email address")) {
    return `${label} is not a valid email address.`;
  }

  if (message.startsWith("String ") || message.startsWith("Input ")) {
    return replaceGenericSubject(message, label);
  }

  if (!messageNamesField(label, message)) {
    return `${label}: ${message}`;
  }

  return message;
}

export async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const first = payload.detail[0] as ApiValidationError;
      if (first.msg) return humanizeValidationMessage(first);
    }
  } catch {
    // Fall through.
  }
  return response.statusText || "Request failed.";
}

export async function parseApiFieldErrors(
  response: Response
): Promise<Record<string, string>> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (!Array.isArray(payload.detail)) return {};

    const errors: Record<string, string> = {};
    for (const item of payload.detail as ApiValidationError[]) {
      const field = item.loc[item.loc.length - 1];
      if (typeof field === "string") {
        errors[field] = humanizeValidationMessage(item);
      }
    }
    return errors;
  } catch {
    return {};
  }
}
