import math

from fastapi import APIRouter
from pydantic import BaseModel, model_validator

from app.scoring import evaluate_risk

router = APIRouter()


class RiskEvaluationRequest(BaseModel):
    weights: dict[str, float]
    scores: dict[str, float]

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
        if any(
            not math.isfinite(value) or value < 0 or value > 5
            for value in self.scores.values()
        ):
            raise ValueError("Scores must be finite numbers between 0 and 5.")
        return self


@router.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "risk_calculator",
    }


# This is used to computer the risk score of a client,
#  if critical component is up
@router.post("/v1/evaluation/", tags=["Evaluation"])
def post_evaluate_risk(request: RiskEvaluationRequest) -> float:
    return evaluate_risk(request.weights, request.scores)


# This is used to cache the formula to evaluate the risk, 
# if critical component is down, we can still evaluate 
# the risk using the cached formula
@router.get("/v1/formula/", tags=["Formula"])
def get_formula() -> str:
    return "sum(weights[key] * scores.get(key, 0) for key in weights) / sum(weights.values()); returns 0 when total weight is 0"