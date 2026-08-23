"""Tests for validation error humanization."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.validation_errors import humanize_validation_error, sanitize_validation_errors
from app.incidents.models import IncidentCreate


def test_empty_title_message_names_field():
    error = {
        "type": "string_too_short",
        "loc": ("body", "title"),
        "msg": "String should have at least 1 character",
        "input": "",
    }

    result = humanize_validation_error(error)

    assert result["msg"] == "Title should have at least 1 character"
    assert "input" not in result


def test_empty_description_message_names_field():
    error = {
        "type": "string_too_short",
        "loc": ("body", "description"),
        "msg": "String should have at least 1 character",
        "input": "",
    }

    result = humanize_validation_error(error)

    assert result["msg"] == "Description should have at least 1 character"


def test_missing_field_message():
    error = {
        "type": "missing",
        "loc": ("body", "category"),
        "msg": "Field required",
    }

    result = humanize_validation_error(error)

    assert result["msg"] == "Category is required."


def test_password_min_length_message():
    error = {
        "type": "string_too_short",
        "loc": ("body", "password"),
        "msg": "String should have at least 8 characters",
    }

    result = humanize_validation_error(error)

    assert result["msg"] == "Password should have at least 8 characters"


def test_incident_create_model_validation_messages():
    with pytest.raises(ValidationError) as exc_info:
        IncidentCreate.model_validate(
            {
                "title": "",
                "description": "",
                "category": "other",
                "origin": "internal",
                "branch": "central",
            }
        )

    sanitized = sanitize_validation_errors(exc_info.value.errors())
    messages = {item["loc"][-1]: item["msg"] for item in sanitized}

    assert messages["title"] == "Title should have at least 1 character"
    assert messages["description"] == "Description should have at least 1 character"
