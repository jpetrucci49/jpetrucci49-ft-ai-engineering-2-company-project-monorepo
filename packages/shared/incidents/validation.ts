import type { IncidentBranch, IncidentCategory, IncidentOrigin, IncidentStatus } from "./constants";

export interface IncidentCreateInput {
  title: string;
  description: string;
  category: IncidentCategory;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  status?: IncidentStatus;
}

export interface IncidentRecord extends IncidentCreateInput {
  id: number;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
}

export interface IncidentSummary {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_origin: Record<string, number>;
  by_branch: Record<string, number>;
}

export interface IncidentFormErrors {
  title?: string;
  description?: string;
  category?: string;
  origin?: string;
  branch?: string;
}

export function validateIncidentForm(values: IncidentCreateInput): IncidentFormErrors {
  const errors: IncidentFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  } else if (values.title.trim().length > 120) {
    errors.title = "Title must be 120 characters or fewer.";
  }

  if (!values.description.trim()) {
    errors.description = "Description is required.";
  }

  if (!values.category) {
    errors.category = "Category is required.";
  }

  if (!values.origin) {
    errors.origin = "Origin is required.";
  }

  if (!values.branch) {
    errors.branch = "Branch is required.";
  }

  return errors;
}

export function hasIncidentFormErrors(errors: IncidentFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
