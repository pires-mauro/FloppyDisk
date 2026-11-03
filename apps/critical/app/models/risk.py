from pydantic import BaseModel, field_validator, model_validator


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
    employee_id: str
    weights: dict[str, int] | None = None
    risk_values: dict[str, dict[str, int | None]] | None = None

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, employee_id: str) -> str:
        if not employee_id.isdigit() or len(employee_id) != 10:
            raise ValueError("Employee internal ID must contain exactly 10 digits.")
        return employee_id

    @field_validator("weights")
    @classmethod
    def validate_weights(
        cls, weights: dict[str, int] | None
    ) -> dict[str, int] | None:
        if weights is not None and not weights:
            raise ValueError("Provide at least one risk-factor weight.")
        if weights is not None and any(not name.strip() for name in weights):
            raise ValueError("Risk-factor names cannot be empty.")
        if weights is not None and any(
            weight < 1 or weight > 5 for weight in weights.values()
        ):
            raise ValueError("Risk-factor weights must be integers between 1 and 5.")
        return weights

    @field_validator("risk_values")
    @classmethod
    def validate_risk_values(
        cls, risk_values: dict[str, dict[str, int | None]] | None
    ) -> dict[str, dict[str, int | None]] | None:
        if risk_values is not None:
            if not risk_values or not any(risk_values.values()):
                raise ValueError("Provide at least one risk-factor risk value.")
            if any(not factor.strip() for factor in risk_values):
                raise ValueError("Risk-factor names cannot be empty.")
            if any(
                not choice.strip()
                for choices in risk_values.values()
                for choice in choices
            ):
                raise ValueError("Risk-value choices cannot be empty.")
            if any(
                risk is not None and (risk < 1 or risk > 5)
                for choices in risk_values.values()
                for risk in choices.values()
            ):
                raise ValueError("Risk values must be integers between 1 and 5.")
        return risk_values

    @model_validator(mode="after")
    def validate_update_content(self) -> "WeightUpdateRequest":
        if self.weights is None and self.risk_values is None:
            raise ValueError("Provide weights or risk values to update.")
        return self
