from typing import Literal

from pydantic import BaseModel, Field
from app.models.client_models import ClientDetails


class RiskReviewRequest(ClientDetails):
    pass


class RiskFactorResult(BaseModel):
    label: str
    value: str
    weight: int
    score: float = Field(ge=0, le=5, allow_inf_nan=False)
    contribution: float


class RiskCalculationResult(BaseModel):
    score: float = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    overrideReason: str | None = None
    contributions: dict[str, float]


class RiskReviewResponse(BaseModel):
    score: float = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    weightVersion: str
    overrideReason: str | None = None
    factors: list[RiskFactorResult]


class FinalizedClient(RiskReviewResponse):
    internal_client_id: int
    finalDecision: Literal['approve', 'manual_review', 'decline']
