"""Shared CSV validation for incident analysis and seeding."""

from __future__ import annotations

import io
import re
from pathlib import Path

import pandas as pd

CLINIC_COUNTRIES: dict[str, str] = {
    "US-TX-01": "US",
    "US-TX-02": "US",
    "US-TX-03": "US",
    "US-FL-01": "US",
    "US-FL-02": "US",
    "US-FL-03": "US",
    "US-GA-01": "US",
    "US-GA-02": "US",
    "US-GA-03": "US",
    "UK-LON-01": "UK",
    "UK-LON-02": "UK",
    "UK-MAN-01": "UK",
}

CATEGORIES = (
    "APPOINTMENT",
    "BILLING",
    "CLINICAL_CARE",
    "ACCESSIBILITY",
    "ADMINISTRATIVE",
)

STATUSES = ("OPEN", "CLOSED", "DISCARDED")

COUNTRIES = ("US", "UK")

REQUIRED_COLUMNS = (
    "incident_id",
    "date",
    "clinic_id",
    "country",
    "category",
    "description",
    "status",
    "patient_id",
    "satisfaction_score",
)

PATIENT_ID_PATTERN = re.compile(r"^PAT-\d{6}$")

INVALID_RULE_LABELS = {
    "invalid_clinic_id": "Invalid or missing clinic_id",
    "country_clinic_mismatch": "Country/clinic mismatch",
    "invalid_category": "Invalid or missing category",
    "empty_description": "Empty description",
    "missing_patient_id": "Missing patient_id",
    "closed_no_score": "Closed case, no score",
    "out_of_range_score": "Out-of-range satisfaction score",
}

BREAKDOWN_RULES = (
    "invalid_clinic_id",
    "country_clinic_mismatch",
    "invalid_category",
    "empty_description",
    "missing_patient_id",
    "closed_no_score",
)


def text_value(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def parse_score(value: object) -> int | None | str:
    """Return score int, None if missing, or 'invalid' if present but not 1-5."""
    text = text_value(value)
    if not text:
        return None
    try:
        numeric = float(text)
        if not numeric.is_integer():
            return "invalid"
        score = int(numeric)
    except ValueError:
        return "invalid"
    if 1 <= score <= 5:
        return score
    return "invalid"


def validate_record(row: pd.Series) -> list[str]:
    violations: list[str] = []

    clinic_id = text_value(row.get("clinic_id"))
    country = text_value(row.get("country"))
    category = text_value(row.get("category"))
    description = text_value(row.get("description"))
    status = text_value(row.get("status"))
    patient_id = text_value(row.get("patient_id"))
    score = parse_score(row.get("satisfaction_score"))

    clinic_valid = clinic_id in CLINIC_COUNTRIES
    if not clinic_valid:
        violations.append("invalid_clinic_id")
    elif country != CLINIC_COUNTRIES[clinic_id]:
        violations.append("country_clinic_mismatch")

    if not category or category not in CATEGORIES:
        violations.append("invalid_category")

    if len(description) < 5:
        violations.append("empty_description")

    if not patient_id or not PATIENT_ID_PATTERN.match(patient_id):
        violations.append("missing_patient_id")

    if score == "invalid":
        violations.append("out_of_range_score")
    elif status == "CLOSED" and score is None:
        violations.append("closed_no_score")

    return violations


def _read_csv(source: io.BytesIO | Path) -> pd.DataFrame:
    return pd.read_csv(source, encoding="utf-8", dtype=str, keep_default_na=False)


def load_incidents_from_path(path: Path) -> pd.DataFrame:
    return _read_csv(path)


def load_incidents_from_bytes(content: bytes) -> pd.DataFrame:
    if not content.strip():
        raise ValueError("empty")
    try:
        return _read_csv(io.BytesIO(content))
    except UnicodeDecodeError as exc:
        raise ValueError("encoding") from exc
    except pd.errors.ParserError as exc:
        raise ValueError("parse") from exc


def validate_columns(df: pd.DataFrame) -> list[str]:
    return [column for column in REQUIRED_COLUMNS if column not in df.columns]
