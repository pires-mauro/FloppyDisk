from typing import Literal

from pydantic import BaseModel

from onboarding_shared.models import HealthCheckResponse, RiskCalculationResult

__all__ = ['FormulaResponse', 'HealthCheckResponse', 'RiskCalculationResult', 'TierThresholds']


class TierThresholds(BaseModel):
    medium: float
    high: float


class FormulaResponse(BaseModel):
    scoringRuleVersion: str
    formula: str
    thresholds: TierThresholds
    missingCpi: Literal['manual_review']
