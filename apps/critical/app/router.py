from fastapi import APIRouter, HTTPException

from app.models.model import HealthCheckResponse, RiskCalculationResult
from onboarding_shared.models import RiskEvaluationRequest
from onboarding_shared.screening import screening_outcome
from app.screening import get_screening_result

from app.scoring import SCORING_RULE_VERSION, evaluate_risk

router = APIRouter()


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
    if request.screeningRequest is not None and not request.screeningToken:
        raise HTTPException(status_code=401, detail='Screening callback credential is required')

    calculation = evaluate_risk(
        request.weights, request.scores,
        pep_confirmed=request.pepConfirmed if request.screeningRequest is None else False,
        sanctions_match=request.sanctionsMatch if request.screeningRequest is None else False,
    )
    if request.screeningRequest is not None:
        screening = get_screening_result(request.screeningRequest, request.screeningToken)
        calculation.tier, calculation.overrideReason = screening_outcome(
            calculation.tier, calculation.overrideReason, screening,
        )
        calculation.screening = screening
    return calculation


# Informational metadata only. Both services use the shared scoring rules;
# no returned expression is executed by the API.
@router.get("/v1/formula/", tags=["Formula"])
def get_formula() -> dict:
    return {
        'scoringRuleVersion': SCORING_RULE_VERSION,
        'formula': 'sum(weight * score) / sum(weights)',
        'thresholds': {'medium': 2.5, 'high': 3.75},
        'missingCpi': 'manual_review',
    }
