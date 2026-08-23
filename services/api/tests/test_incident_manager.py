"""Tests for incident manager detail and not-found handling (M11)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.incidents.manager import create_incident, get_incident
from app.incidents.manager_router import get_incident_by_id, patch_incident_status
from app.incidents.models import IncidentCreate, IncidentStatus, IncidentStatusUpdate
from auth.models import UserRegister
from auth.services import users as user_service


@pytest.fixture
def manager_user():
    result = user_service.create_user(
        UserRegister(email="manager@example.com", password="securepass123", name="Manager")
    )
    user = user_service.get_user_by_id(result.user.id)
    assert user is not None
    return user


def _sample_incident() -> IncidentCreate:
    return IncidentCreate(
        title="Test incident",
        description="No PHI in this test incident.",
        category="other",
        origin="internal",
        branch="central",
        status="open",
    )


def test_get_incident_returns_none_for_missing_id():
    assert get_incident(99999) is None


def test_get_incident_by_id_returns_404_for_missing_numeric_id(manager_user):
    with pytest.raises(HTTPException) as exc_info:
        get_incident_by_id("99999", manager_user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Incident not found."


def test_get_incident_by_id_returns_404_for_non_numeric_id(manager_user):
    with pytest.raises(HTTPException) as exc_info:
        get_incident_by_id("abc", manager_user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Incident not found."


def test_get_incident_by_id_returns_existing_incident(manager_user):
    created = create_incident(_sample_incident())
    incident = get_incident_by_id(str(created.id), manager_user)
    assert incident.id == created.id
    assert incident.title == created.title


def test_patch_incident_status_returns_404_for_missing_id(manager_user):
    with pytest.raises(HTTPException) as exc_info:
        patch_incident_status("99999", IncidentStatusUpdate(status=IncidentStatus.RESOLVED), manager_user)

    assert exc_info.value.status_code == 404
