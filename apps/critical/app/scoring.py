from app.models.model import RiskCalculationResult

SCORING_RULE_VERSION = 'weighted-risk-v1'


def evaluate_risk(
    weights: dict[str, float], scores: dict[str, float | None], *,
    pep_confirmed: bool = False, sanctions_match: bool = False,
) -> RiskCalculationResult:
    """ This function evaluates the risk score of a client based on the provided weights. 
        The formula is as follows: 
            sum(weights[key] * scores[key] for key in weights) / sum(weights.values())
    Args:
        weights (dict[str, float]): The weights used to calculate the risk score.
        scores (dict[str, float]): The scores used to calculate the risk score.

    Returns:
        float: The calculated risk score a value between 0 and 5, 
        where 0 indicates low risk and 5 indicates high risk.
    """

    missing = [key for key, value in scores.items() if value is None]
    if missing:
        red_flags = ' / '.join(
            reason for reason, matched in [('Sanctions', sanctions_match), ('PEP', pep_confirmed)]
            if matched
        )
        return RiskCalculationResult(
            scoringRuleVersion=SCORING_RULE_VERSION,
            score=None,
            tier='High Risk' if red_flags else 'Medium Risk',
            overrideReason=red_flags or f'Missing CPI: {", ".join(missing)}; manual review required',
            contributions={key: None for key in weights},
        )

    total_weight = sum(weights.values())
    score = sum(
        (weights[key] / total_weight) * scores.get(key, 0)
        for key in weights
    )

    # Determine the risk tier based on the calculated score
    if score < 2.5:
        tier = "Low Risk"
    elif score < 3.75:
        tier = "Medium Risk"
    else:
        tier = "High Risk"

    override_reason = ' / '.join(
        reason for reason, matched in [('Sanctions', sanctions_match), ('PEP', pep_confirmed)]
        if matched
    ) or None
    return RiskCalculationResult(
        scoringRuleVersion=SCORING_RULE_VERSION,
        score=round(score, 2),
        tier='High Risk' if override_reason else tier,
        overrideReason=override_reason,
        contributions={key: (weights[key] / total_weight) * scores.get(key, 0) for key in weights},
    )
