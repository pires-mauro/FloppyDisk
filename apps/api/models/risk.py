from pydantic import BaseModel


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
