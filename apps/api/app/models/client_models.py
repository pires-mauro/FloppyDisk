from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from onboarding_shared.screening import MatchDecision

from app.models.officer_models import OFFICER_CREDENTIALS_EXAMPLE


CountryCode = Annotated[str, Field(pattern=r'^[A-Z]{2}$')]
DocumentNumber = Annotated[str, Field(min_length=1, max_length=100)]
CLIENT_DETAILS_EXAMPLE = {
    "clientName": "Example Client",
    "clientId": "DOC0001",
    "dateOfBirth": "1990-01-01",
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


class ClientAddress(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    street: Annotated[str, Field(min_length=1)]
    city: Annotated[str, Field(min_length=1)]
    houseNumber: str | None = None
    postalCode: str | None = None


class ClientDetails(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={"examples": [CLIENT_DETAILS_EXAMPLE]},
    )

    clientName: DocumentNumber
    clientId: DocumentNumber
    dateOfBirth: date
    countryOfResidence: CountryCode
    address: ClientAddress
    taxDomicile: CountryCode
    nationality: CountryCode
    idIssuingCountry: CountryCode
    annualIncome: int | str
    profession: int | str
    maritalStatus: Literal['Single', 'Married', 'Divorced', 'Widowed', 'Separated']
    email: Annotated[str, Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')]
    dialPrefix: Annotated[str, Field(pattern=r'^\+[1-9][0-9]{0,2}$')]
    phoneNumber: Annotated[str, Field(min_length=9, max_length=9, pattern=r'^[0-9]{9}$')]
    officerComment: Annotated[str, Field(max_length=500)] = ''
    screeningDecisions: dict[str, MatchDecision] = Field(
        default_factory=dict, description="Officer decisions keyed by the screening candidate's entity ID.",
    )

    @field_validator('dateOfBirth', mode='before')
    @classmethod
    def parse_birth_date(cls, value):
        if isinstance(value, str) and len(value) == 10 and value[2] == '-':
            return datetime.strptime(value, '%d-%m-%Y').date()
        return value

    @field_validator('dateOfBirth')
    @classmethod
    def require_adult(cls, value: date):
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise ValueError('Client must be at least 18 years of age')
        return value


class ClientSubmission(ClientDetails):
    model_config = ConfigDict(json_schema_extra={
        "examples": [{**CLIENT_DETAILS_EXAMPLE, **OFFICER_CREDENTIALS_EXAMPLE, "finalDecision": "approve"}],
    })

    officerId: Annotated[str, Field(pattern=r'^[0-9]{10}$')]
    officerPassword: SecretStr = Field(min_length=1, max_length=1024)
    finalDecision: Literal['approve', 'manual_review', 'decline']


class ManualReviewDecision(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "examples": [{**OFFICER_CREDENTIALS_EXAMPLE, "assessmentId": 12, "finalDecision": "approve"}],
    })

    officerId: Annotated[str, Field(pattern=r'^[0-9]{10}$')]
    officerPassword: SecretStr = Field(min_length=1, max_length=1024)
    finalDecision: Literal['approve', 'decline']
    officerComment: Annotated[str, Field(max_length=500)] = ''
    assessmentId: Annotated[int, Field(gt=0)] | None = None


class ClientDecisionSaved(BaseModel):
    preliminary: bool
    internal_client_id: int
    finalDecision: Literal['approve', 'decline']


class DuplicateResponse(BaseModel):
    exists: bool


class OfficerClientOverview(BaseModel):
    preliminary: bool
    internal_client_id: int
    client_name: str
    issuing_country: str
    risk_tier: str
    final_decision: str
    officer_id: str
    officer_name: str
    submission_date: datetime
    document_number: DocumentNumber


class SavedClientProfile(BaseModel):
    name: str
    documentNumber: str
    issuingCountry: str
    dateOfBirth: date
    nationality: str
    taxDomicile: str
    countryOfResidence: str
    address: ClientAddress
    income: str
    profession: str
    maritalStatus: str
    email: str
    phone: str
