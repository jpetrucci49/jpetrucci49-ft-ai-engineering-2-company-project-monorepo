"use client";

import { useState } from "react";

import { createManagedIncident, IncidentsManagerApiError } from "@/lib/api/incidents-manager";
import {
  INCIDENT_BRANCHES,
  INCIDENT_CATEGORIES,
  INCIDENT_ORIGINS,
  type IncidentBranch,
  type IncidentCategory,
  type IncidentCreateInput,
  type IncidentOrigin,
  hasIncidentFormErrors,
  validateIncidentForm,
  type IncidentFormErrors,
} from "@healthcore/incidents";
import {
  BRANCH_LABELS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
} from "@healthcore/incidents/labels";

const EMPTY_FORM: IncidentCreateInput = {
  title: "",
  description: "",
  category: "patient_experience",
  origin: "branch",
  branch: "central",
};

export function IncidentRegisterForm() {
  const [values, setValues] = useState<IncidentCreateInput>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<IncidentFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const clientErrors = validateIncidentForm(values);
    if (hasIncidentFormErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await createManagedIncident({ ...values, status: "open" });
      setValues(EMPTY_FORM);
      setSuccessMessage("Incident registered successfully.");
    } catch (error) {
      if (error instanceof IncidentsManagerApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Unable to register the incident. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const highlightBranch = values.origin === "branch";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Register incident</h2>
        <p className="mt-1 text-sm text-slate-600">Record a new operational incident for tracking and audit.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Title</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={values.title}
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          maxLength={120}
          required
        />
        {fieldErrors.title ? <span className="text-sm text-red-600">{fieldErrors.title}</span> : null}
      </label>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Patient privacy reminder</p>
        <p className="mt-1">
          Do not enter patient names, dates of birth, medical record numbers, or other identifying information in
          the description. Use opaque internal references only.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <textarea
          className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={values.description}
          onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          required
        />
        {fieldErrors.description ? (
          <span className="text-sm text-red-600">{fieldErrors.description}</span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.category}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, category: event.target.value as IncidentCategory }))
            }
          >
            {INCIDENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Origin</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.origin}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, origin: event.target.value as IncidentOrigin }))
            }
          >
            {INCIDENT_ORIGINS.map((origin) => (
              <option key={origin} value={origin}>
                {ORIGIN_LABELS[origin]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        className={`block space-y-1 rounded-md p-3 ${
          highlightBranch ? "border-2 border-sky-400 bg-sky-50" : "border border-transparent"
        }`}
      >
        <span className="text-sm font-medium text-slate-700">Branch</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={values.branch}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, branch: event.target.value as IncidentBranch }))
          }
          required
        >
          {INCIDENT_BRANCHES.map((branch) => (
            <option key={branch} value={branch}>
              {BRANCH_LABELS[branch]}
            </option>
          ))}
        </select>
        {highlightBranch ? (
          <span className="text-xs text-sky-800">Confirm the clinic or location reporting this incident.</span>
        ) : null}
        {fieldErrors.branch ? <span className="text-sm text-red-600">{fieldErrors.branch}</span> : null}
      </label>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {successMessage ? <p className="text-sm text-green-700">{successMessage}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Register incident"}
      </button>
    </form>
  );
}
