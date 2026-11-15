from typing import Literal

from pydantic import BaseModel, Field
from app.models.client_models import ClientDetails


class RiskReviewRequest(ClientDetails):
    pass


class RiskFactorResult(BaseModel):
    label: str
    value: str
    weight: float
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    contribution: float | None


class RiskCalculationResult(BaseModel):
    scoringRuleVersion: str = 'unknown'
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    overrideReason: str | None = None
    contributions: dict[str, float | None]


class RiskReviewResponse(BaseModel):
    preliminary: bool = False
    scoringSource: Literal['critical', 'cached'] = 'critical'
    scoringRuleVersion: str = 'unknown'
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    weightVersion: str
    overrideReason: str | None = None
    factors: list[RiskFactorResult]


class FinalizedClient(RiskReviewResponse):
    internal_client_id: int
    finalDecision: Literal['approve', 'manual_review', 'decline']
