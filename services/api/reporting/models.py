"""Pydantic shapes for reporting endpoints. KPI fields match CONTEXT-company.md."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ClinicSupplyPerformance(BaseModel):
    clinic_id: str
    country: str
    total_supply_cost: float
    supply_consumption_count: int
    critical_stockout_count: int
    expiry_risk_count: int
    currency: str


class MonthlyClinicSupplyPerformanceOut(BaseModel):
    month_start: date | None
    clinics: list[ClinicSupplyPerformance]


class PipelineRunOut(BaseModel):
    id: str
    pipeline_name: str
    month_start: date | None
    started_at: str | None
    finished_at: str | None
    status: str
    records_read: int
    records_written: int
    error_message: str | None = None
    prefect_flow_run_id: str | None = None


class PipelineRunTriggerIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month_start: date | None = Field(
        default=None,
        description="UTC month as YYYY-MM-DD. Defaults to the previous calendar month.",
    )


class PipelineRunTriggerOut(BaseModel):
    pipeline_name: str
    month_start: date
    status: str
    records_read: int
    records_written: int
    source: str | None = None
    missing_inbound_cost_count: int = 0
