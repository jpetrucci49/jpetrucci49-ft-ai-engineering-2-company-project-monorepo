import type { IncidentBranch, IncidentCategory, IncidentStatus } from "./constants";

export const BRANCH_LABELS: Record<IncidentBranch, string> = {
  central: "Central — Austin Main Clinic",
  austin_north: "Austin — North",
  dallas_uptown: "Dallas Uptown",
  houston_med_center: "Houston Medical Center",
  san_antonio_west: "San Antonio West",
  miami_brickell: "Miami Brickell",
  miami_doral: "Miami Doral",
  orlando_east: "Orlando East",
  tampa_bay: "Tampa Bay",
  atlanta_midtown: "Atlanta Midtown",
  savannah: "Savannah",
  london_city: "London City",
  london_west: "London West End",
  manchester_central: "Manchester Central",
};

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  clinical_equipment: "Clinical equipment",
  it_system: "IT system",
  billing_error: "Billing error",
  compliance_breach: "Compliance breach",
  patient_experience: "Patient experience",
  staff_issue: "Staff issue",
  facility_issue: "Facility issue",
  referral_issue: "Referral issue",
  other: "Other",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  discarded: "Discarded",
};

export const ORIGIN_LABELS = {
  customer: "Customer",
  branch: "Branch",
  internal: "Internal",
} as const;

export function getBranchLabel(branch: IncidentBranch): string {
  return BRANCH_LABELS[branch];
}

export function getCategoryLabel(category: IncidentCategory): string {
  return CATEGORY_LABELS[category];
}

export function getStatusLabel(status: IncidentStatus): string {
  return STATUS_LABELS[status];
}
