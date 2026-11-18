"""Versioned scoring rules used by critical and the backend fallback."""

import math

SCORING_RULE_VERSION = 'weighted-risk-v1'


def calculate_risk(
    weights: dict[str, float], scores: dict[str, float | None], *,
    pep_confirmed: bool = False, sanctions_match: bool = False,
) -> dict:
    if not weights or weights.keys() != scores.keys():
        raise ValueError('Provide matching non-empty weights and scores.')
    if any(not math.isfinite(value) or value < 0 for value in weights.values()):
        raise ValueError('Weights must be finite and non-negative.')
    total_weight = sum(weights.values())
    if not math.isfinite(total_weight) or total_weight <= 0:
        raise ValueError('At least one weight must be positive.')
    if any(value is not None and (not math.isfinite(value) or not 0 <= value <= 5)
           for value in scores.values()):
        raise ValueError('Scores must be finite numbers between 0 and 5.')
    missing = [key for key, value in scores.items() if value is None]
    if any(key not in {'country_of_residence', 'nationality', 'tax_domicile'} for key in missing):
        raise ValueError('Only country factors can have missing CPI scores.')
    override_reason = ' / '.join(
        reason for reason, matched in [('Sanctions', sanctions_match), ('PEP', pep_confirmed)]
        if matched
    ) or None
    if missing:
        return {
            'score': None,
            'tier': 'High Risk' if override_reason else 'Medium Risk',
            'overrideReason': override_reason or f'Missing CPI: {", ".join(missing)}; manual review required',
            'contributions': {key: None for key in weights},
            'scoringRuleVersion': SCORING_RULE_VERSION,
        }
    contributions = {key: weights[key] / total_weight * scores[key] for key in weights}
    score = sum(contributions.values())
    tier = 'Low Risk' if score < 2.5 else 'Medium Risk' if score < 3.75 else 'High Risk'
    return {
        'score': round(score, 2),
        'tier': 'High Risk' if override_reason else tier,
        'overrideReason': override_reason,
        'contributions': contributions,
        'scoringRuleVersion': SCORING_RULE_VERSION,
    }
