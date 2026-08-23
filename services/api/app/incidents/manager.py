"""Incident manager persistence and business rules."""

from __future__ import annotations

from datetime import UTC, datetime

from app.incidents.models import (
    ALL_BRANCHES,
    ALL_CATEGORIES,
    ALL_ORIGINS,
    ALL_STATUSES,
    IncidentBranch,
    IncidentCategory,
    IncidentCreate,
    IncidentInDB,
    IncidentOrigin,
    IncidentPublic,
    IncidentStatus,
    IncidentSummary,
)
from incidents_database import get_incidents_table
from tinydb import Query

ALLOWED_STATUS_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.OPEN: {IncidentStatus.IN_PROGRESS, IncidentStatus.DISCARDED},
    IncidentStatus.IN_PROGRESS: {IncidentStatus.RESOLVED, IncidentStatus.DISCARDED},
    IncidentStatus.RESOLVED: set(),
    IncidentStatus.DISCARDED: set(),
}


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _to_public(document: dict) -> IncidentPublic:
    data = {key: value for key, value in document.items() if key != "seed_key"}
    return IncidentPublic.model_validate(data)


def _to_in_db(document: dict) -> IncidentInDB:
    return IncidentInDB.model_validate(document)


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def list_incidents(
    *,
    status: IncidentStatus | None = None,
    origin: IncidentOrigin | None = None,
    branch: IncidentBranch | None = None,
    category: IncidentCategory | None = None,
) -> list[IncidentPublic]:
    documents = get_incidents_table().all()
    results: list[IncidentPublic] = []

    for document in documents:
        incident = _to_public(document)
        if status is not None and incident.status != status:
            continue
        if origin is not None and incident.origin != origin:
            continue
        if branch is not None and incident.branch != branch:
            continue
        if category is not None and incident.category != category:
            continue
        results.append(incident)

    results.sort(key=lambda item: item.created_at, reverse=True)
    return results


def get_incident(incident_id: int) -> IncidentPublic | None:
    document = get_incidents_table().get(doc_id=incident_id)
    if document is None:
        return None
    return _to_public(document)


def create_incident(
    payload: IncidentCreate,
    *,
    seed_key: str | None = None,
    created_at: datetime | None = None,
) -> IncidentPublic:
    table = get_incidents_table()

    if seed_key is not None and _seed_key_exists(seed_key):
        existing = table.search(Query().seed_key == seed_key)
        if existing:
            return _to_public(existing[0])

    now = created_at or _utc_now()
    document = payload.model_dump(mode="json")
    document["created_at"] = now.isoformat()
    document["updated_at"] = now.isoformat()
    if seed_key is not None:
        document["seed_key"] = seed_key

    doc_id = table.insert(document)
    table.update({"id": doc_id}, doc_ids=[doc_id])
    stored = table.get(doc_id=doc_id)
    assert stored is not None
    return _to_public(stored)


def update_incident_status(incident_id: int, new_status: IncidentStatus) -> IncidentPublic:
    table = get_incidents_table()
    document = table.get(doc_id=incident_id)
    if document is None:
        raise LookupError("Incident not found.")

    current = IncidentStatus(document["status"])
    allowed = ALLOWED_STATUS_TRANSITIONS[current]
    if new_status not in allowed:
        raise ValueError(
            f"Cannot change status from '{current.value}' to '{new_status.value}'."
        )

    now = _utc_now()
    table.update(
        {"status": new_status.value, "updated_at": now.isoformat()},
        doc_ids=[incident_id],
    )
    updated = table.get(doc_id=incident_id)
    assert updated is not None
    return _to_public(updated)


def get_summary() -> IncidentSummary:
    by_status = {status.value: 0 for status in ALL_STATUSES}
    by_category = {category.value: 0 for category in ALL_CATEGORIES}
    by_origin = {origin.value: 0 for origin in ALL_ORIGINS}
    by_branch = {branch.value: 0 for branch in ALL_BRANCHES}

    for document in get_incidents_table().all():
        incident = _to_public(document)
        by_status[incident.status.value] += 1
        by_category[incident.category.value] += 1
        by_origin[incident.origin.value] += 1
        by_branch[incident.branch.value] += 1

    total = sum(by_status.values())
    return IncidentSummary(
        total=total,
        by_status=by_status,
        by_category=by_category,
        by_origin=by_origin,
        by_branch=by_branch,
    )


def _seed_key_exists(seed_key: str) -> bool:
    return bool(get_incidents_table().search(Query().seed_key == seed_key))


def seed_key_exists(seed_key: str) -> bool:
    return _seed_key_exists(seed_key)
