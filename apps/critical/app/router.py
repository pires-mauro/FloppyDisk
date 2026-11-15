import math

from fastapi import APIRouter

from app.models.model import HealthCheckResponse, RiskCalculationResult
from pydantic import BaseModel, model_validator

from app.scoring import SCORING_RULE_VERSION, evaluate_risk

router = APIRouter()


class RiskEvaluationRequest(BaseModel):
    weights: dict[str, float]
    scores: dict[str, float | None]
    # Temporary screening inputs until the OpenSanctions integration is ready.
    pepConfirmed: bool = False
    sanctionsMatch: bool = False

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


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def health_check():
    return HealthCheckResponse(
        status="ok",
        service="bank-risk-scoring-service",
    )

# This is used to compute the risk score of a client,
#  if critical component is up
@router.post("/v1/evaluation/", tags=["Evaluation"])
def post_evaluate_risk(request: RiskEvaluationRequest) -> RiskCalculationResult:
    return evaluate_risk(
        request.weights, request.scores,
        pep_confirmed=request.pepConfirmed, sanctions_match=request.sanctionsMatch,
    )


# Informational metadata only. The API has a local fallback copy of the rules;
# no returned expression is executed by the API.
@router.get("/v1/formula/", tags=["Formula"])
def get_formula() -> dict:
    return {
        'scoringRuleVersion': SCORING_RULE_VERSION,
        'formula': 'sum(weight * score) / sum(weights)',
        'thresholds': {'medium': 2.5, 'high': 3.75},
        'missingCpi': 'manual_review',
    }
