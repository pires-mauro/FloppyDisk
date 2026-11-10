import pydantic

from typing import Literal

class HealthCheckResponse(pydantic.BaseModel):
    status: str
    service: str


class RiskCalculationResult(pydantic.BaseModel):
    score: float = pydantic.Field(ge=1, le=5)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    overrideReason: str | None = None
    contributions: dict[str, float]