import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.models.officer_models import OfficerLoginRequest
from app.officer_auth import OfficerAuthenticationError
from app.router import login_officer


class OfficerLoginTests(unittest.TestCase):
    def test_login_returns_officer_role_after_authentication(self):
        connection = MagicMock()
        connection.__enter__.return_value = connection
        connection.execute.return_value.fetchone.return_value = ("0000000001", True)
        request = OfficerLoginRequest(
            officerId="0000000001",
            officerPassword="valid-password",
        )

        with (
            patch("app.router.get_connection", return_value=connection),
            patch("app.router.authenticate_officer", return_value=8) as authenticate,
        ):
            response = login_officer(request)

        authenticate.assert_called_once_with(connection, "0000000001", "valid-password")
        self.assertEqual(response.officerId, "0000000001")
        self.assertTrue(response.isAdmin)

    def test_login_rejects_invalid_credentials(self):
        request = OfficerLoginRequest(
            officerId="0000000001",
            officerPassword="invalid-password",
        )
        with (
            patch("app.router.get_connection"),
            patch(
                "app.router.authenticate_officer",
                side_effect=OfficerAuthenticationError("Officer ID or password is incorrect"),
            ),
            self.assertRaises(HTTPException) as error,
        ):
            login_officer(request)

        self.assertEqual(error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
