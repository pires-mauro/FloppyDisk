def evaluate_risk(weights: dict[str, float], scores: dict[str, float]) -> float:
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

    total_weight = sum(weights.values())
    if total_weight == 0:
        return 0.0
    return sum(
        (weights[key] / total_weight) * scores.get(key, 0)
        for key in weights
    )