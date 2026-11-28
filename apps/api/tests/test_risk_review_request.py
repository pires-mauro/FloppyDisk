import unittest

from pydantic import ValidationError

from app.models.client_models import ClientSubmission
from app.models.risk import OfficerRiskReviewRequest, RiskReviewRequest


CLIENT_DETAILS = {
    "clientName": "Example Client",
    "clientId": "DOC0001",
    "dateOfBirth": "01-01-1990",
    "countryOfResidence": "LU",
    "address": {"street": "Example Street", "city": "Luxembourg"},
    "taxDomicile": "LU",
    "nationality": "LU",
    "idIssuingCountry": "LU",
    "annualIncome": "10k-50k",
    "profession": "Standard",
    "maritalStatus": "Single",
    "email": "example@email.com",
    "dialPrefix": "+352",
    "phoneNumber": "012345678",
}


class RiskReviewRequestTests(unittest.TestCase):
    def test_internal_risk_input_does_not_require_officer_credentials(self):
        request = RiskReviewRequest.model_validate(CLIENT_DETAILS)

        self.assertEqual(request.clientName, "Example Client")

    def test_screened_risk_review_requires_officer_credentials(self):
        with self.assertRaises(ValidationError):
            OfficerRiskReviewRequest.model_validate(CLIENT_DETAILS)

    def test_legacy_frontend_flags_are_ignored(self):
        request = OfficerRiskReviewRequest.model_validate({
            **CLIENT_DETAILS,
            "officerId": "0000000000",
            "officerPassword": "example",
            "pepConfirmed": True,
            "sanctionsMatch": True,
        })

        self.assertEqual(request.screeningDecisions, {})
        self.assertNotIn("pepConfirmed", request.model_dump())
        self.assertNotIn("sanctionsMatch", request.model_dump())

    def test_client_submission_still_requires_authenticated_officer_fields(self):
        with self.assertRaises(ValidationError):
            ClientSubmission.model_validate({
                **CLIENT_DETAILS,
                "finalDecision": "approve",
            })


if __name__ == "__main__":
    unittest.main()
