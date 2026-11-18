"""Calculation checks for FR-07 and FR-12 using independently worked examples.

Run from apps/critical: python -m unittest discover -s tests -v
These tests call the real calculator without HTTP or database dependencies.
"""

import unittest

from app.scoring import evaluate_risk


class RiskCalculationTests(unittest.TestCase):
    # FR-07: Calculate the correct weighted average.
    def test_weighted_average(self):
        # (2 * 1 + 3 * 4) / 5 = 2.8
        result = evaluate_risk({"country": 2, "income": 3}, {"country": 1, "income": 4})

        self.assertEqual(result.score, 2.8)
        self.assertEqual(result.tier, "Medium Risk")

    # FR-07: Floor the final weighted score to two decimal places.
    def test_score_flooring(self):
        weights = {"country": 1, "nationality": 2, "tax": 3, "profession": 4, "income": 5}
        scores = {"country": 1, "nationality": 2, "tax": 3, "profession": 4, "income": 5}

        result = evaluate_risk(weights, scores)

        # (1 + 4 + 9 + 16 + 25) / 15 = 3.666... -> 3.66
        self.assertEqual(result.score, 3.66)
        self.assertEqual(result.tier, "Medium Risk")

    # FR-07: Flooring must not push scores into the next risk tier.
    def test_flooring_boundaries(self):
        cases = (
            (2.4999, 2.49, "Low Risk"),
            (2.499999, 2.49, "Low Risk"),
            (2.50, 2.50, "Medium Risk"),
            (3.7499, 3.74, "Medium Risk"),
            (3.749999, 3.74, "Medium Risk"),
            (3.75, 3.75, "High Risk"),
        )
        for raw_score, expected_score, expected_tier in cases:
            with self.subTest(raw_score=raw_score):
                result = evaluate_risk({"a": 1}, {"a": raw_score})
                self.assertEqual(
                    (result.score, result.tier),
                    (expected_score, expected_tier),
                )

    # FR-07: Assign the correct tier at each score boundary.
    def test_tier_boundaries(self):
        cases = (
            (0.00, "Low Risk"),
            (1.00, "Low Risk"),
            (2.49, "Low Risk"),
            (2.50, "Medium Risk"),
            (3.74, "Medium Risk"),
            (3.75, "High Risk"),
            (5.00, "High Risk"),
        )
        for expected_score, expected_tier in cases:
            with self.subTest(score=expected_score):
                high_weight = expected_score / 5
                result = evaluate_risk(
                    {"low": 1 - high_weight, "high": high_weight},
                    {"low": 0, "high": 5},
                )
                self.assertEqual(result.score, expected_score)
                self.assertEqual(result.tier, expected_tier)

    # FR-07: Equal weights give the ordinary average.
    def test_equal_weights(self):
        result = evaluate_risk({"a": 1, "b": 1, "c": 1}, {"a": 1, "b": 3, "c": 5})

        self.assertEqual(result.score, 3.0)
        self.assertEqual(result.tier, "Medium Risk")

    # FR-07: Scaling all weights equally must not change the result.
    def test_scaled_weights(self):
        scores = {"country": 1, "income": 4}
        original = evaluate_risk({"country": 2, "income": 3}, scores)
        scaled = evaluate_risk({"country": 4, "income": 6}, scores)

        self.assertEqual(original.score, 2.8)
        self.assertEqual(scaled.score, original.score)
        self.assertEqual(scaled.tier, original.tier)

    # FR-07: A zero-weight factor contributes nothing (extra boundary check).
    def test_zero_weight(self):
        result = evaluate_risk({"country": 0, "income": 2}, {"country": 5, "income": 1})

        self.assertEqual(result.score, 1.0)
        self.assertEqual(result.tier, "Low Risk")
        self.assertEqual(result.contributions["country"], 0)

    # FR-12: Return the correct contribution for each factor.
    def test_factor_contributions(self):
        result = evaluate_risk({"country": 2, "income": 3}, {"country": 1, "income": 4})

        self.assertEqual(set(result.contributions), {"country", "income"})
        self.assertAlmostEqual(result.contributions["country"], 0.4)
        self.assertAlmostEqual(result.contributions["income"], 2.4)
        self.assertAlmostEqual(sum(result.contributions.values()), 2.8)

    # FR-12: Repeated calculations give the same result without changing inputs.
    def test_repeatable_results(self):
        weights = {"country": 2, "income": 3}
        scores = {"country": 1, "income": 4}
        first = evaluate_risk(weights, scores)
        second = evaluate_risk(weights, scores)

        self.assertEqual(first, second)
        self.assertEqual(weights, {"country": 2, "income": 3})
        self.assertEqual(scores, {"country": 1, "income": 4})


if __name__ == "__main__":
    unittest.main()
