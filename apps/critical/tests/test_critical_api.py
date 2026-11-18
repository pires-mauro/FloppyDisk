"""Critical service boundary/contract tests, including FR-09 regression checks.

FR-09 tests guard the required PEP and sanctions overrides against regressions.
"""

import unittest

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.router import RiskEvaluationRequest


class CriticalApiTests(unittest.TestCase):
    # Send requests directly to the app; no running web server is needed.
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    # FR-07 / FR-12: Check the API's score, tier and factor contributions.
    def test_reference_profile(self):
        response = self.client.post('/v1/evaluation/', json={
            'weights': {'country': 2, 'income': 3},
            'scores': {'country': 1, 'income': 4},
        })
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['score'], 2.8)
        self.assertEqual(result['tier'], 'Medium Risk')
        self.assertIsNone(result['overrideReason'])
        self.assertEqual(set(result['contributions']), {'country', 'income'})
        self.assertAlmostEqual(result['contributions']['country'], 0.4)
        self.assertAlmostEqual(result['contributions']['income'], 2.4)

    # FR-07: Accept the lowest and highest allowed scores with correct tiers.
    def test_score_boundaries(self):
        for score, expected_score, tier in (
            (0, 0, 'Low Risk'),
            (0.9999, 0.99, 'Low Risk'),  # Accepted input; response floors to two decimals.
            (1, 1, 'Low Risk'),
            (5, 5, 'High Risk'),
        ):
            with self.subTest(score=score):
                response = self.client.post('/v1/evaluation/', json={
                    'weights': {'a': 1}, 'scores': {'a': score},
                })
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['score'], expected_score)
                self.assertEqual(response.json()['tier'], tier)

    # FR-07: The API must return the floored score and the corresponding tier.
    def test_flooring_boundaries(self):
        cases = (
            (2.4999, 2.49, 'Low Risk'),
            (2.50, 2.50, 'Medium Risk'),
            (3.7499, 3.74, 'Medium Risk'),
            (3.75, 3.75, 'High Risk'),
        )
        for raw_score, expected_score, expected_tier in cases:
            with self.subTest(raw_score=raw_score):
                response = self.client.post('/v1/evaluation/', json={
                    'weights': {'a': 1}, 'scores': {'a': raw_score},
                })
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertEqual(
                    (result['score'], result['tier']),
                    (expected_score, expected_tier),
                )

    # FR-07: Agreed range is 0-5; reject scores just outside it with HTTP 422.
    def test_invalid_scores(self):
        for score in (-0.0001, 5.0001):
            with self.subTest(score=score):
                response = self.client.post('/v1/evaluation/', json={
                    'weights': {'a': 1}, 'scores': {'a': score},
                })
                self.assertEqual(response.status_code, 422)

    # Extra validation: reject a negative weight even if another weight is positive.
    def test_negative_weight(self):
        response = self.client.post('/v1/evaluation/', json={
            'weights': {'a': -0.0001, 'b': 1}, 'scores': {'a': 1, 'b': 2},
        })
        self.assertEqual(response.status_code, 422)

    # Extra boundary check: reject all-zero weights rather than dividing by zero.
    def test_zero_total_weight(self):
        response = self.client.post('/v1/evaluation/', json={
            'weights': {'a': 0, 'b': 0}, 'scores': {'a': 1, 'b': 5},
        })
        self.assertEqual(response.status_code, 422)

    # Extra validation: reject a request with no factors to calculate.
    def test_empty_factors(self):
        response = self.client.post('/v1/evaluation/', json={'weights': {}, 'scores': {}})
        self.assertEqual(response.status_code, 422)

    # Extra validation: every weight must have a matching score, with no extra scores.
    def test_mismatched_factors(self):
        for scores in ({}, {'b': 1}, {'a': 1, 'b': 2}):
            with self.subTest(scores=scores):
                response = self.client.post('/v1/evaluation/', json={
                    'weights': {'a': 1}, 'scores': scores,
                })
                self.assertEqual(response.status_code, 422)

    # Extra validation: factor names cannot be empty or contain only whitespace.
    def test_blank_factor_names(self):
        for key in ('', ' ', '\t'):
            with self.subTest(key=key):
                response = self.client.post('/v1/evaluation/', json={
                    'weights': {key: 1}, 'scores': {key: 1},
                })
                self.assertEqual(response.status_code, 422)

    # Extra validation: reject missing fields, null maps and nonnumeric values.
    def test_invalid_inputs(self):
        payloads = (
            {}, {'weights': {'a': 1}}, {'scores': {'a': 1}},
            {'weights': None, 'scores': {'a': 1}},
            {'weights': {'a': 1}, 'scores': None},
            {'weights': {'a': 'invalid'}, 'scores': {'a': 1}},
            {'weights': {'a': 1}, 'scores': {'a': 'invalid'}},
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post('/v1/evaluation/', json=payload)
                self.assertEqual(response.status_code, 422)

    # Extra validation: reject NaN and infinity in either weights or scores.
    def test_nonfinite_values(self):
        # NaN/Infinity are not standard JSON: exercise the model directly.
        for field in ('weights', 'scores'):
            for value in (float('nan'), float('inf'), float('-inf')):
                with self.subTest(field=field, value=value):
                    payload = {'weights': {'a': 1}, 'scores': {'a': 1}}
                    payload[field]['a'] = value
                    with self.assertRaises(ValidationError):
                        RiskEvaluationRequest.model_validate(payload)

    # Extra boundary check: reject weights whose sum overflows to infinity.
    def test_weight_overflow(self):
        with self.assertRaises(ValidationError):
            RiskEvaluationRequest(
                weights={'a': 1e308, 'b': 1e308}, scores={'a': 1, 'b': 5},
            )

    # Extra boundary check: a very small positive weight still gives a valid score.
    def test_small_weight(self):
        response = self.client.post('/v1/evaluation/', json={
            'weights': {'a': 1e-200}, 'scores': {'a': 3},
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['score'], 3)

    # Shared FR-09 check: lowest-risk inputs must become High Risk when flagged.
    def assert_red_flag_override(self, **flags):
        response = self.client.post('/v1/evaluation/', json={
            'weights': {'country': 1, 'income': 1},
            'scores': {'country': 1, 'income': 1},
            **flags,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tier'], 'High Risk',
                         'FR-09: a red flag must override lowest-risk inputs')

    # FR-09: PEP alone must override a Low Risk calculation.
    def test_pep_override(self):
        self.assert_red_flag_override(pepConfirmed=True, sanctionsMatch=False)

    # FR-09: A sanctions match alone must override a Low Risk calculation.
    def test_sanctions_override(self):
        self.assert_red_flag_override(pepConfirmed=False, sanctionsMatch=True)

    # FR-09: The override must also apply when both flags are true.
    def test_combined_override(self):
        self.assert_red_flag_override(pepConfirmed=True, sanctionsMatch=True)


if __name__ == '__main__':
    unittest.main()
