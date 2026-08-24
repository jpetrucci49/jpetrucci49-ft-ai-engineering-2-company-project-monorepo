#!/usr/bin/env python3
"""Seed incident manager data from scripts/incidents.csv."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

# Allow imports from services/api when running with the API virtualenv.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_API_ROOT = _REPO_ROOT / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

import pandas as pd  # noqa: E402

from app.incidents.csv_validation import load_incidents_from_bytes, text_value, validate_record  # noqa: E402
from app.incidents.manager import create_incident, seed_key_exists  # noqa: E402
from app.incidents.models import (  # noqa: E402
    IncidentBranch,
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentStatus,
)

DEFAULT_CSV = _REPO_ROOT / "scripts" / "incidents.csv"

CSV_STATUS_TO_MODEL: dict[str, IncidentStatus] = {
    "OPEN": IncidentStatus.OPEN,
    "CLOSED": IncidentStatus.RESOLVED,
    "DISCARDED": IncidentStatus.DISCARDED,
}

CSV_CATEGORY_TO_MODEL: dict[str, IncidentCategory] = {
    "APPOINTMENT": IncidentCategory.PATIENT_EXPERIENCE,
    "BILLING": IncidentCategory.BILLING_ERROR,
    "CLINICAL_CARE": IncidentCategory.PATIENT_EXPERIENCE,
    "ACCESSIBILITY": IncidentCategory.PATIENT_EXPERIENCE,
    "ADMINISTRATIVE": IncidentCategory.OTHER,
}

CLINIC_ID_TO_BRANCH: dict[str, IncidentBranch] = {
    "US-TX-01": IncidentBranch.CENTRAL,
    "US-TX-02": IncidentBranch.AUSTIN_NORTH,
    "US-TX-03": IncidentBranch.HOUSTON_MED_CENTER,
    "US-FL-01": IncidentBranch.MIAMI_BRICKELL,
    "US-FL-02": IncidentBranch.ORLANDO_EAST,
    "US-FL-03": IncidentBranch.TAMPA_BAY,
    "US-GA-01": IncidentBranch.ATLANTA_MIDTOWN,
    "US-GA-02": IncidentBranch.ATLANTA_MIDTOWN,
    "US-GA-03": IncidentBranch.SAVANNAH,
    "UK-LON-01": IncidentBranch.LONDON_CITY,
    "UK-LON-02": IncidentBranch.LONDON_WEST,
    "UK-MAN-01": IncidentBranch.MANCHESTER_CENTRAL,
}


def _parse_created_at(date_value: str) -> datetime:
    return datetime.strptime(date_value, "%Y-%m-%d").replace(tzinfo=UTC)


def _derive_title(description: str) -> str | None:
    title = description.strip()[:120]
    return title or None


def _build_seed_key(row: pd.Series, title: str, created_at: datetime) -> str:
    incident_id = text_value(row.get("incident_id"))
    if incident_id:
        return incident_id
    return f"{title}|{created_at.date().isoformat()}"


def _transform_row(row: pd.Series) -> IncidentCreate | None:
    description = text_value(row.get("description"))
    title = _derive_title(description)
    if not title:
        return None

    csv_status = text_value(row.get("status"))
    status = CSV_STATUS_TO_MODEL.get(csv_status)
    if status is None:
        return None

    csv_category = text_value(row.get("category"))
    category = CSV_CATEGORY_TO_MODEL.get(csv_category)
    if category is None:
        return None

    clinic_id = text_value(row.get("clinic_id"))
    branch = CLINIC_ID_TO_BRANCH.get(clinic_id, IncidentBranch.CENTRAL)

    return IncidentCreate(
        title=title,
        description=description,
        category=category,
        status=status,
        origin=IncidentOrigin.CUSTOMER,
        branch=branch,
    )


def main() -> int:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    if not csv_path.is_file():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    try:
        content = csv_path.read_bytes()
    except OSError:
        print("Unable to read CSV file.", file=sys.stderr)
        return 1

    try:
        df = load_incidents_from_bytes(content)
    except ValueError:
        print("Unable to parse CSV file. Ensure UTF-8 encoding and comma separator.", file=sys.stderr)
        return 1

    inserted = 0
    skipped_duplicate = 0
    rejected = 0

    try:
        for _, row in df.iterrows():
            if validate_record(row):
                rejected += 1
                continue

            payload = _transform_row(row)
            if payload is None:
                rejected += 1
                continue

            date_value = text_value(row.get("date"))
            try:
                created_at = _parse_created_at(date_value)
            except ValueError:
                rejected += 1
                continue

            seed_key = _build_seed_key(row, payload.title, created_at)
            if seed_key_exists(seed_key):
                skipped_duplicate += 1
                continue

            create_incident(payload, seed_key=seed_key, created_at=created_at)
            inserted += 1
    except Exception:
        print("Seeding failed while writing incidents.", file=sys.stderr)
        return 1

    print(f"Seed complete — inserted: {inserted}, skipped (duplicate): {skipped_duplicate}, rejected: {rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
