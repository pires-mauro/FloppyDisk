from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


Factor = Literal['country_weight', 'nationality_weight', 'tax_domicile_weight',
                 'professional_activity_weight', 'income_weight']
Rating = Annotated[int, Field(strict=True, ge=1, le=5)]


class FactorWeights(BaseModel):
    model_config = ConfigDict(extra='forbid')

    country_weight: Rating
    nationality_weight: Rating
    tax_domicile_weight: Rating
    professional_activity_weight: Rating
    income_weight: Rating


class WeightUpdate(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        json_schema_extra={'example': {
            'employee_id': '0000000001',
            'weights': {'country_weight': 3, 'nationality_weight': 2,
                        'tax_domicile_weight': 2, 'professional_activity_weight': 4,
                        'income_weight': 1},
        }},
    )
    employee_id: str = Field(pattern=r'^[0-9]{10}$')
    password: SecretStr = Field(min_length=1, max_length=1024)
    weights: FactorWeights | None = None
    risk_values: dict[Factor, dict[str, Rating | None]] | None = None

    @model_validator(mode='after')
    def require_update(self):
        if self.weights is None and not any((self.risk_values or {}).values()):
            raise ValueError('Supply weights or at least one risk-value change')
        return self


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
    def validate_legacy_weights(
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


class WeightVersion(BaseModel):
    version: str


class ScoringConfiguration(WeightVersion):
    weights: FactorWeights
    risk_values: dict[Factor, dict[str, Rating]]
