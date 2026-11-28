import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from onboarding_shared.screening import ScreeningRequest, ScreeningResult


class HealthCheckResponse(BaseModel):
    status: str
    service: str


class ErrorResponse(BaseModel):
    detail: str


class ValidationIssue(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class ValidationErrorResponse(BaseModel):
    detail: list[ValidationIssue]


class RiskEvaluationRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        'examples': [{
            'weights': {'income': 1.5, 'nationality': 0.5},
            'scores': {'income': 2.0, 'nationality': 1.1},
        }],
    })

    weights: dict[str, float] = Field(
        description='Relative weights by risk factor. At least one weight must be positive.',
    )
    scores: dict[str, float | None] = Field(
        description='Risk values on the 0–5 scale for the same factor names as the weights. Null represents missing CPI for a country factor.',
    )
    # Legacy flags are used when reprocessing assessments saved before screening.
    pepConfirmed: bool = False
    sanctionsMatch: bool = False
    screeningRequest: ScreeningRequest | None = Field(default=None, description='Optional lookup data supplied by the onboarding API.')
    screeningToken: str | None = Field(default=None, description='Short-lived callback credential issued by the onboarding API.')

    @model_validator(mode="after")
    def validate_factors(self):
        if not self.weights or self.weights.keys() != self.scores.keys():
            raise ValueError("Provide matching non-empty weights and scores.")
        if any(not key.strip() for key in self.weights):
            raise ValueError("Risk factor names cannot be empty.")
        if any(
            not math.isfinite(value) or value < 0
            for value in self.weights.values()
        ):
            raise ValueError("Weights must be finite, non-negative numbers.")
        total_weight = sum(self.weights.values())
        if not math.isfinite(total_weight) or total_weight <= 0:
            raise ValueError("At least one risk factor must have a positive weight.")
        country_factors = {'country_of_residence', 'nationality', 'tax_domicile'}
        if any(value is None and key not in country_factors for key, value in self.scores.items()):
            raise ValueError('Only country factors can have missing CPI scores.')
        if any(
            value is not None and (not math.isfinite(value) or value < 0 or value > 5)
            for value in self.scores.values()
        ):
            raise ValueError("Scores must be finite numbers between 0 and 5.")
        return self


class RiskCalculationResult(BaseModel):
    scoringRuleVersion: str = 'unknown'
    score: float | None = Field(ge=0, le=5, allow_inf_nan=False)
    tier: Literal['Low Risk', 'Medium Risk', 'High Risk']
    overrideReason: str | None = None
    contributions: dict[str, float | None]
    screening: ScreeningResult | None = None
