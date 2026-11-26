from fastapi import APIRouter, HTTPException

from app.models.model import FormulaResponse, HealthCheckResponse, RiskCalculationResult, TierThresholds
from onboarding_shared.models import ErrorResponse, RiskEvaluationRequest
from onboarding_shared.screening import screening_outcome
from app.screening import get_screening_result

from app.scoring import SCORING_RULE_VERSION, evaluate_risk

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"], summary="Check scoring service health")
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="bank-risk-scoring-service",
    )

# This is used to compute the risk score of a client,
#  if critical component is up
@router.post(
    "/v1/evaluation/",
    response_model=RiskCalculationResult,
    tags=["Evaluation"],
    summary="Calculate a weighted risk score",
    responses={
        401: {"model": ErrorResponse, "description": "The request includes screening data and needs a callback credential."},
        502: {"model": ErrorResponse, "description": "The screening lookup could not be completed."},
    },
)
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
@router.get(
    "/v1/formula/", response_model=FormulaResponse, tags=["Formula"], summary="Get scoring formula metadata",
)
def get_formula() -> FormulaResponse:
    return FormulaResponse(
        scoringRuleVersion=SCORING_RULE_VERSION,
        formula='sum(weight * score) / sum(weights)',
        thresholds=TierThresholds(medium=2.5, high=3.75),
        missingCpi='manual_review',
    )
