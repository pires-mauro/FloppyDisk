import pydantic

from typing import Literal

class HealthCheckResponse(pydantic.BaseModel):
    status: str
    service: str


class RiskCalculationResult(pydantic.BaseModel):
    scoringRuleVersion: str
    score: float | None = pydantic.Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    overrideReason: str | None = None
    contributions: dict[str, float | None]
