from onboarding_shared.scoring import SCORING_RULE_VERSION, calculate_risk

from app.models.model import RiskCalculationResult


def evaluate_risk(
    weights: dict[str, float], scores: dict[str, float | None], *,
    pep_confirmed: bool = False, sanctions_match: bool = False,
) -> RiskCalculationResult:
    return RiskCalculationResult.model_validate(calculate_risk(
        weights, scores, pep_confirmed=pep_confirmed, sanctions_match=sanctions_match,
    ))
