"""Telemetry clinic integers (1–12) → reporting slugs, country, and currency.

Names match context/06.5_PIPELINE_CONTEXT.md and PIPELINE_DESIGN.md §4.2.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ClinicDimension:
    telemetry_id: int
    clinic_id: str
    label: str
    country: str
    currency: str


CLINICS: tuple[ClinicDimension, ...] = (
    ClinicDimension(1, "austin-main", "Austin Main", "US", "USD"),
    ClinicDimension(2, "austin-north", "Austin North", "US", "USD"),
    ClinicDimension(3, "dallas-uptown", "Dallas Uptown", "US", "USD"),
    ClinicDimension(4, "houston-medical-center", "Houston Medical Center", "US", "USD"),
    ClinicDimension(5, "san-antonio-west", "San Antonio West", "US", "USD"),
    ClinicDimension(6, "miami-brickell", "Miami Brickell", "US", "USD"),
    ClinicDimension(7, "orlando-east", "Orlando East", "US", "USD"),
    ClinicDimension(8, "tampa-bay", "Tampa Bay", "US", "USD"),
    ClinicDimension(9, "atlanta-midtown", "Atlanta Midtown", "US", "USD"),
    ClinicDimension(10, "london-city", "London City", "UK", "GBP"),
    ClinicDimension(11, "london-west", "London West", "UK", "GBP"),
    ClinicDimension(12, "manchester-central", "Manchester Central", "UK", "GBP"),
)

CLINICS_BY_TELEMETRY_ID: dict[int, ClinicDimension] = {
    clinic.telemetry_id: clinic for clinic in CLINICS
}


def _as_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def resolve_clinic(tags: dict[str, Any] | None) -> ClinicDimension | None:
    """Map tags.clinic_id to a reporting clinic. Drop unknown ids and country mismatches."""
    if not tags:
        return None
    telemetry_id = _as_int(tags.get("clinic_id"))
    if telemetry_id is None:
        return None
    clinic = CLINICS_BY_TELEMETRY_ID.get(telemetry_id)
    if clinic is None:
        return None
    country = tags.get("country")
    if country is not None and str(country).strip() != clinic.country:
        return None
    return clinic
