import type { IncidentStatus } from "./constants";

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["in_progress", "discarded"],
  in_progress: ["resolved", "discarded"],
  resolved: [],
  discarded: [],
};

export function isValidStatusTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getAllowedNextStatuses(from: IncidentStatus): IncidentStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
