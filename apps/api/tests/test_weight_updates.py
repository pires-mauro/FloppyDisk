import unittest

from pydantic import ValidationError

from app.weight_store import merge_weight_values
from models.risk import WeightUpdateRequest


class WeightUpdateTests(unittest.TestCase):
    def test_partial_risk_value_update_preserves_other_saved_values(self):
        merged_weights, merged_risk_values = merge_weight_values(
            {"country_weight": 3},
            {"country_weight": {"LU": 2, "DE": 4}},
            None,
            {"country_weight": {"LU": 5}},
        )

        self.assertEqual(merged_weights, {"country_weight": 3})
        self.assertEqual(
            merged_risk_values,
            {"country_weight": {"LU": 5, "DE": 4}},
        )

    def test_partial_weight_update_preserves_risk_values_and_other_weights(self):
        merged_weights, merged_risk_values = merge_weight_values(
            {"country_weight": 3, "income_weight": 2},
            {"country_weight": {"LU": 4}},
            {"country_weight": 5},
            None,
        )

        self.assertEqual(
            merged_weights,
            {"country_weight": 5, "income_weight": 2},
        )
        self.assertEqual(merged_risk_values, {"country_weight": {"LU": 4}})

    def test_explicit_risk_value_removal_preserves_other_choices(self):
        _, merged_risk_values = merge_weight_values(
            {},
            {"country_weight": {"LU": 2, "DE": 4}},
            None,
            {"country_weight": {"LU": None}},
        )

        self.assertEqual(merged_risk_values, {"country_weight": {"DE": 4}})

    def test_risk_values_can_be_submitted_without_weights(self):
        request = WeightUpdateRequest(
            employee_id="1234567890",
            risk_values={"country_weight": {"LU": 5}},
        )

        self.assertIsNone(request.weights)
        self.assertEqual(request.risk_values, {"country_weight": {"LU": 5}})

    def test_risk_value_range_is_validated(self):
        with self.assertRaises(ValidationError):
            WeightUpdateRequest(
                employee_id="1234567890",
                risk_values={"country_weight": {"LU": 6}},
            )


if __name__ == "__main__":
    unittest.main()
