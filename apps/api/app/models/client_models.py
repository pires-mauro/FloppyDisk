from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


CountryCode = Annotated[str, Field(pattern=r'^[A-Z]{2}$')]
DocumentNumber = Annotated[str, Field(min_length=1, max_length=100)]


class ClientAddress(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    street: Annotated[str, Field(min_length=1)]
    city: Annotated[str, Field(min_length=1)]
    houseNumber: str | None = None
    postalCode: str | None = None


class ClientSubmission(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
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
                "officerId": "1234567890",
                "sanctionsMatch": False,
                "riskScore": 2,
                "riskTier": "Low Risk",
                "finalDecision": "approve",
                "weightVersion": 1,
            }
        },
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
    officerId: Annotated[str, Field(min_length=10, max_length=10, pattern=r'^[0-9]{10}$')]
    officerComment: Annotated[str, Field(max_length=500)] = ''
    sanctionsMatch: bool = False
    riskScore: Decimal = Field(ge=1, le=5, decimal_places=2)
    riskTier: Literal['Low Risk', 'Medium Risk', 'High Risk']
    finalDecision: Literal['approve', 'manual_review', 'decline']
    weightVersion: int = Field(gt=0)

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

    @model_validator(mode='after')
    def validate_decision(self):
        expected = {'Low Risk': 'approve', 'Medium Risk': 'manual_review', 'High Risk': 'decline'}
        if self.finalDecision != expected[self.riskTier]:
            raise ValueError('Final decision does not match the reviewed risk tier')
        score_tier = 'Low Risk' if self.riskScore < Decimal('2.50') else (
            'Medium Risk' if self.riskScore < Decimal('3.75') else 'High Risk')
        # A screening override can raise the tier above the numerical result.
        override = self.sanctionsMatch and self.riskTier == 'High Risk'
        if self.riskTier != score_tier and not override:
            raise ValueError('Reviewed tier does not match score or screening override')
        return self


class DuplicateResponse(BaseModel):
    exists: bool


class ClientCreated(BaseModel):
    internal_client_id: int


class ClientOverview(BaseModel):
    internal_client_id: int
    client_name: str
    issuing_country: str
    risk_tier: str
    final_decision: str
    officer_id: str
    submission_date: datetime
