"""HIPAA + UK GDPR identifier scan. One function, both regimes."""

from __future__ import annotations

import re

_PATTERNS = (
    # "Patient Johnson", not "patient must" or "patient to".
    re.compile(r"\b[Pp]atients?\s+[A-Z][a-zA-Z'-]+\b"),
    re.compile(r"\b(?:mrn|medical record(?:\s+number)?)\b[:#]?\s*\w+", re.IGNORECASE),
    re.compile(r"\bnhs\s+number\b[:#]?\s*\w*", re.IGNORECASE),
    re.compile(r"\bnhs\s*[:#]\s*\d+", re.IGNORECASE),
    re.compile(r"\b(?:dob|date of birth)\b", re.IGNORECASE),
    re.compile(
        r"\b(?:diagnos(?:is|ed)|lab results?|clinical notes?|visit notes?)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\binsurance\s+(?:number|id|#)\b", re.IGNORECASE),
    re.compile(r"\b(?:ssn|national insurance)\b", re.IGNORECASE),
)

_QUASI_CLINIC = re.compile(
    r"\b(?:Austin|Manchester|London|Houston|Dallas|Miami|Orlando|Tampa|"
    r"Atlanta|Savannah|clinic)\b",
    re.IGNORECASE,
)
_QUASI_AGE = re.compile(r"\b(?:age\s*)?\d{1,3}\b")
_QUASI_DX = re.compile(r"\bdiagnos", re.IGNORECASE)

PHI_REFUSAL = (
    "I can't remember that. HealthCore memory cannot store patient identifiers "
    "or PHI under HIPAA or UK GDPR."
)


def contains_phi(text: str) -> bool:
    blob = (text or "").strip()
    if not blob:
        return False
    return any(pattern.search(blob) for pattern in _PATTERNS)


def redact_phi(text: str) -> tuple[str, bool]:
    """Replace identifier spans with ``[REDACTED]``. Uses the same patterns as ``contains_phi``."""
    blob = text or ""
    if not contains_phi(blob):
        return blob, False
    redacted = blob
    for pattern in _PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted, True


def contains_quasi_identifier(text: str) -> bool:
    """Age together with a diagnosis and a clinic. A policy mention of a patient is not enough."""
    blob = (text or "").strip()
    if not blob:
        return False
    return bool(
        _QUASI_AGE.search(blob) and _QUASI_DX.search(blob) and _QUASI_CLINIC.search(blob)
    )


def contains_phi_or_quasi(text: str) -> bool:
    return contains_phi(text) or contains_quasi_identifier(text)
