"""REST endpoints for the incident manager (M11)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.incidents.manager import (
    create_incident,
    get_incident,
    get_summary,
    list_incidents,
    update_incident_status,
)
from app.incidents.models import (
    IncidentBranch,
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentPublic,
    IncidentStatus,
    IncidentStatusUpdate,
    IncidentSummary,
)
from auth.dependencies import get_current_user
from auth.models import UserPublic

router = APIRouter(prefix="/incidents", tags=["incident-manager"])


@router.post("", response_model=IncidentPublic, status_code=status.HTTP_201_CREATED)
def post_incident(
    payload: IncidentCreate,
    _: Annotated[UserPublic, Depends(get_current_user)],
) -> IncidentPublic:
    return create_incident(payload)


@router.get("", response_model=list[IncidentPublic])
def get_incidents(
    _: Annotated[UserPublic, Depends(get_current_user)],
    status: IncidentStatus | None = None,
    origin: IncidentOrigin | None = None,
    branch: IncidentBranch | None = None,
    category: IncidentCategory | None = None,
) -> list[IncidentPublic]:
    return list_incidents(
        status=status,
        origin=origin,
        branch=branch,
        category=category,
    )


@router.get("/summary", response_model=IncidentSummary)
def get_incidents_summary(
    _: Annotated[UserPublic, Depends(get_current_user)],
) -> IncidentSummary:
    return get_summary()


@router.get("/{incident_id}", response_model=IncidentPublic)
def get_incident_by_id(
    incident_id: int,
    _: Annotated[UserPublic, Depends(get_current_user)],
) -> IncidentPublic:
    incident = get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentPublic)
def patch_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    _: Annotated[UserPublic, Depends(get_current_user)],
) -> IncidentPublic:
    try:
        return update_incident_status(incident_id, payload.status)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
