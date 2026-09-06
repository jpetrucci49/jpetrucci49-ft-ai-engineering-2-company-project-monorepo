"""Three reporting endpoints. ETL lives in data/pipelines/ — this module only imports it."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.dependencies import get_current_user
from auth.models import UserPublic
from data.pipelines.monthly_clinic_supply_performance.flow import (
    run_monthly_clinic_supply_performance,
)
from data.pipelines.monthly_clinic_supply_performance.queries import (
    get_latest_pipeline_run,
    query_monthly_clinic_supply_performance,
)
from reporting.models import (
    MonthlyClinicSupplyPerformanceOut,
    PipelineRunOut,
    PipelineRunTriggerIn,
    PipelineRunTriggerOut,
)

router = APIRouter(prefix="/reporting", tags=["reporting"])


@router.get(
    "/monthly-clinic-supply-performance",
    response_model=MonthlyClinicSupplyPerformanceOut,
)
def get_monthly_clinic_supply_performance(
    _: Annotated[UserPublic, Depends(get_current_user)],
    month_start: date | None = Query(
        default=None,
        description="UTC month (YYYY-MM-DD). Defaults to the most recent computed month.",
    ),
) -> MonthlyClinicSupplyPerformanceOut:
    payload = query_monthly_clinic_supply_performance(month_start)
    return MonthlyClinicSupplyPerformanceOut.model_validate(payload)


@router.get("/pipeline-runs/latest", response_model=PipelineRunOut)
def get_latest_run(
    _: Annotated[UserPublic, Depends(get_current_user)],
) -> PipelineRunOut:
    payload = get_latest_pipeline_run()
    if payload is None:
        raise HTTPException(status_code=404, detail="No pipeline runs recorded.")
    return PipelineRunOut.model_validate(payload)


@router.post("/pipeline-runs", response_model=PipelineRunTriggerOut)
def trigger_pipeline_run(
    _: Annotated[UserPublic, Depends(get_current_user)],
    body: PipelineRunTriggerIn | None = None,
) -> PipelineRunTriggerOut:
    month = body.month_start if body is not None else None
    result = run_monthly_clinic_supply_performance(
        month_start=month,
        allow_sample=False,
    )
    return PipelineRunTriggerOut.model_validate(result)
