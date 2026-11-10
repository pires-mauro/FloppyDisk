from typing import Literal

from pydantic import BaseModel, Field


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
    pepConfirmed: bool = False
    sanctionsMatch: bool = False


class RiskFactorResult(BaseModel):
    label: str
    value: str
    weight: int
    score: int
    contribution: float


class RiskCalculationResult(BaseModel):
    score: float = Field(ge=1, le=5)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    overrideReason: str | None = None
    contributions: dict[str, float]


class RiskReviewResponse(BaseModel):
    score: float = Field(ge=1, le=5)
    tier: Literal["Low Risk", "Medium Risk", "High Risk"]
    weightVersion: str
    overrideReason: str | None = None
    factors: list[RiskFactorResult]
