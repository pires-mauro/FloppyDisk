import unittest
from unittest.mock import MagicMock, patch

from pydantic import ValidationError

from app.officer_auth import (
    OfficerAuthenticationError,
    OfficerNotAdmin,
    authenticate_officer,
)
from app.db.weights import save_configuration
from app.passwords import hash_password, verify_password
from app.weight_store import merge_weight_values
from app.models.weight_models import WeightUpdate, WeightUpdateRequest


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

    def test_non_admin_cannot_save_weights_or_risk_values(self):
        connection = MagicMock()
        connection.__enter__.return_value = connection
        officer = MagicMock()
        officer.fetchone.return_value = (2, False, hash_password("valid-password"))
        connection.execute.return_value = officer

        update = WeightUpdate(
            employee_id="0000000001",
            password="valid-password",
            risk_values={"country_weight": {"LU": 3}},
        )
        with patch("app.db.weights.get_connection", return_value=connection):
            with self.assertRaises(OfficerNotAdmin):
                save_configuration(update)

        connection.execute.assert_called_once()
        self.assertIn("is_admin", connection.execute.call_args.args[0])

    def test_password_hash_verifies_only_the_original_password(self):
        password_hash = hash_password("correct horse battery staple")

        self.assertTrue(verify_password("correct horse battery staple", password_hash))
        self.assertFalse(verify_password("incorrect password", password_hash))

    def test_malformed_or_missing_password_hash_is_rejected(self):
        self.assertFalse(verify_password("password", None))
        self.assertFalse(verify_password("password", "invalid-hash"))

    def test_seeded_demo_password_hashes_match_the_documented_passwords(self):
        self.assertTrue(verify_password(
            "AliceAdmin!2026",
            "scrypt$16384$8$1$tKxm-KrpASDJIARiMaQ0RA$yXAJYuhuf69__tjpj2Ldc_Nwnz8H-hed0_AvOAx9GTo",
        ))
        self.assertTrue(verify_password(
            "BobOfficer!2026",
            "scrypt$16384$8$1$QWhOLcb7kaQ_oa3eA1epIQ$e5aE2KzF8cWJLWhgwYTSG_pe1zWtcSlHEQlJe6bktFY",
        ))

    def test_wrong_password_is_rejected_before_authorization(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = (
            1,
            True,
            hash_password("correct-password"),
        )

        with self.assertRaises(OfficerAuthenticationError):
            authenticate_officer(connection, "0000000000", "wrong-password")


if __name__ == "__main__":
    unittest.main()
