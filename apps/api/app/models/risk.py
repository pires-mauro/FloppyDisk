from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from onboarding_shared.models import RiskCalculationResult
from onboarding_shared.screening import ScreeningResult
from app.models.client_models import ClientDetails, SavedClientProfile
from app.models.officer_models import OfficerLoginRequest


class RiskReviewRequest(ClientDetails):
    pass


class OfficerRiskReviewRequest(RiskReviewRequest, OfficerLoginRequest):
    pass


class RiskFactorResult(BaseModel):
    label: str
    value: str
    weight: float
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    contribution: float | None


class RiskReviewResponse(BaseModel):
    preliminary: bool = False
    scoringSource: Literal['critical', 'cached'] = 'critical'
    scoringRuleVersion: str = 'unknown'
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    weightVersion: str
    overrideReason: str | None = None
    factors: list[RiskFactorResult]
    screening: ScreeningResult | None = None


class FinalizedClient(RiskReviewResponse):
    internal_client_id: int
    finalDecision: Literal['approve', 'manual_review', 'decline']


class SavedClientReview(BaseModel):
    clientId: int
    assessmentId: int
    profile: SavedClientProfile
    decision: str
    tier: str
    score: float | None
    preliminary: bool
    weightVersion: int
    scoringRuleVersion: str | None = None
    reviewReason: str | None = None
    evaluatedAt: datetime
    officerId: str
    officerName: str
    officerComment: str | None = None
    factors: list[RiskFactorResult] = Field(default_factory=list)
    screening: ScreeningResult | None = None
    savedRoles: list[str] = Field(default_factory=list)
