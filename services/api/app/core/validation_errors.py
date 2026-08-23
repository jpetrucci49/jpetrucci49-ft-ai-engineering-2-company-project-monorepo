"""Human-readable validation error formatting for API responses."""

from __future__ import annotations

import re

FIELD_LABELS: dict[str, str] = {
    "title": "Title",
    "description": "Description",
    "category": "Category",
    "origin": "Origin",
    "branch": "Branch",
    "status": "Status",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "phone": "Phone",
    "address": "Address",
    "token": "Reset token",
    "new_password": "New password",
    "current_password": "Current password",
    "monthly_rate": "Monthly rate",
    "categories": "Categories",
    "country": "Country",
    "currency": "Currency",
    "contact_email": "Contact email",
    "compliance_agreement": "Compliance agreement",
    "contract_renewal_date": "Contract renewal date",
    "notes": "Notes",
    "role": "Role",
    "is_active": "Active status",
}

_SKIP_LOC_PARTS = frozenset({"body", "query", "path", "header", "cookie"})


def _field_label(loc: tuple | list) -> str | None:
    if not loc:
        return None
    for part in reversed(loc):
        if isinstance(part, str) and part not in _SKIP_LOC_PARTS:
            return FIELD_LABELS.get(part, part.replace("_", " ").title())
    return None


def _message_names_field(label: str, message: str) -> bool:
    return label.lower() in message.lower()


def _replace_generic_subject(message: str, label: str) -> str:
    if message.startswith("String "):
        return f"{label}{message[6:]}"
    if message.startswith("Input "):
        return f"{label}{message[5:]}"
    return message


def _normalize_known_value_errors(message: str, label: str) -> str:
    lowered = message.lower()
    if lowered == "name must not be empty":
        return f"{label} must not be empty."
    if lowered == "categories must contain at least one item":
        return "Categories must contain at least one item."
    if lowered.startswith("invalid categories:"):
        values = message.split(":", 1)[1].strip()
        return f"Categories has invalid value(s): {values}."
    if lowered.startswith("currency must be"):
        return message.replace("currency", "Currency", 1)
    return message


def humanize_validation_error(error: dict) -> dict:
    """Return a sanitized validation error with a field-specific message."""
    safe = {key: error[key] for key in ("loc", "msg", "type") if key in error}
    label = _field_label(safe.get("loc", ()))
    message = str(safe.get("msg", ""))
    error_type = safe.get("type", "")

    if not label:
        return safe

    if _message_names_field(label, message) and error_type != "string_too_short":
        safe["msg"] = message
        return safe

    if error_type == "missing":
        safe["msg"] = f"{label} is required."
    elif error_type in {"string_too_short", "string_too_long"}:
        safe["msg"] = _replace_generic_subject(message, label)
    elif error_type == "greater_than":
        match = re.search(r"greater than ([0-9.]+)", message)
        threshold = match.group(1) if match else "0"
        safe["msg"] = f"{label} must be greater than {threshold}."
    elif error_type == "enum":
        safe["msg"] = f"{label} has an invalid value."
    elif error_type in {"enum_type", "literal_error"}:
        safe["msg"] = f"{label} has an invalid value."
    elif error_type == "value_error":
        normalized = _normalize_known_value_errors(message, label)
        if _message_names_field(label, normalized):
            safe["msg"] = normalized
        else:
            safe["msg"] = f"{label}: {normalized}"
    elif message.startswith("value is not a valid email address"):
        safe["msg"] = f"{label} is not a valid email address."
    elif message.startswith("String ") or message.startswith("Input "):
        safe["msg"] = _replace_generic_subject(message, label)
    elif not _message_names_field(label, message):
        safe["msg"] = f"{label}: {message}"

    return safe


def sanitize_validation_errors(errors: list[dict]) -> list[dict]:
    """Strip sensitive fields and rewrite messages with field labels."""
    return [humanize_validation_error(error) for error in errors]
