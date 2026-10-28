from pydantic import BaseModel, field_validator


class RiskReviewRequest(BaseModel):
    clientName: str
    clientId: str = ""
    dateOfBirth: str
    countryOfResidence: str
    taxDomicile: str
    nationality: str
    idIssuingCountry: str
    annualIncome: str
    profession: str
    maritalStatus: str
    email: str
    dialPrefix: str
    phoneNumber: str
    officerId: str
    officerComment: str = ""


class RiskReviewResponse(BaseModel):
    score: float


class WeightUpdateRequest(BaseModel):
    weights: dict[str, int]

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, weights: dict[str, int]) -> dict[str, int]:
        if not weights:
            raise ValueError("Provide at least one risk-factor weight.")
        if any(not name.strip() for name in weights):
            raise ValueError("Risk-factor names cannot be empty.")
        if any(weight < 1 or weight > 5 for weight in weights.values()):
            raise ValueError("Risk-factor weights must be integers between 1 and 5.")
        return weights
