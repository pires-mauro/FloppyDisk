from fastapi import APIRouter

from app.models.model import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def health_check():
    return HealthCheckResponse(
        status="ok",
        service="bank-risk-scoring-service",
    )

# This is used to compute the risk score of a client,
#  if critical component is up
@router.get("/v1/evaluation/", tags=["Evaluation"])
def evaluate_risk():
    return {
        "message": "Risk evaluation completed successfully",
    }


# This is used to cache the formula to evaluate the risk, 
# if critical component is down, we can still evaluate 
# the risk using the cached formula
@router.get("/v1/formula/", tags=["Formula"])
def get_formula():
    return {
        "message": "Formula retrieved successfully",
    }