export const INCIDENT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "discarded",
] as const;

export const INCIDENT_ORIGINS = ["customer", "branch", "internal"] as const;

export const INCIDENT_CATEGORIES = [
  "clinical_equipment",
  "it_system",
  "billing_error",
  "compliance_breach",
  "patient_experience",
  "staff_issue",
  "facility_issue",
  "referral_issue",
  "other",
] as const;

export const INCIDENT_BRANCHES = [
  "central",
  "austin_north",
  "dallas_uptown",
  "houston_med_center",
  "san_antonio_west",
  "miami_brickell",
  "miami_doral",
  "orlando_east",
  "tampa_bay",
  "atlanta_midtown",
  "savannah",
  "london_city",
  "london_west",
  "manchester_central",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentOrigin = (typeof INCIDENT_ORIGINS)[number];
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentBranch = (typeof INCIDENT_BRANCHES)[number];
