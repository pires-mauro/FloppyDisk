import json
import logging
import os
from typing import Annotated
from urllib.error import HTTPError as URLHTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError
from psycopg.errors import ForeignKeyViolation

from app.db.clients import (
    DuplicateClient,
    client_exists,
    list_clients,
    save_client,
)
from app.db.reference_data import (
    get_countries,
    get_income_ranges,
    get_professional_categories,
)
from app.db.weights import ConfigurationConflict, get_configuration, save_configuration
from app.models.client_models import (
    ClientCreated,
    ClientOverview,
    ClientSubmission,
    DuplicateResponse,
)
from app.models.health_models import HealthCheckResponse
from app.models.reference_data_models import (
    CountryResponse,
    IncomeRangeResponse,
    ProfessionalCategoryResponse,
)
from app.models.risk import (
    RiskCalculationResult,
    RiskFactorResult,
    RiskReviewRequest,
    RiskReviewResponse,
)
from app.models.weight_models import ScoringConfiguration, WeightUpdate, WeightVersion

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"]
)
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="bank-onboarding-api",
    )


RISK_FACTORS = (
    ("country_weight", "country_of_residence", "Country of residence", "countryOfResidence"),
    ("nationality_weight", "nationality", "Nationality", "nationality"),
    ("tax_domicile_weight", "tax_domicile", "Tax domicile", "taxDomicile"),
    ("professional_activity_weight", "profession", "Professional activity", "profession"),
    ("income_weight", "income", "Annual income", "annualIncome"),
)


def _call_risk_service(
    weights: dict[str, int],
    scores: dict[str, int],
    *,
    pep_confirmed: bool,
    sanctions_match: bool,
) -> RiskCalculationResult:
    base_url = os.environ.get("RISK_SERVICE_URL", "http://critical:8000").rstrip("/")
    request = Request(
        f"{base_url}/v1/evaluation/",
        data=json.dumps({
            "weights": weights,
            "scores": scores,
            "pepConfirmed": pep_confirmed,
            "sanctionsMatch": sanctions_match,
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except URLHTTPError as exc:
        logger.warning("Risk service returned HTTP %s", exc.code)
        raise HTTPException(status_code=502, detail="Risk calculation service returned an error") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Risk service is unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Risk calculation service is unavailable") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.warning("Risk service returned an invalid response")
        raise HTTPException(status_code=502, detail="Risk calculation service returned an invalid response") from exc

    try:
        result = RiskCalculationResult.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="Risk calculation service returned an invalid evaluation") from exc
    if result.contributions.keys() != weights.keys():
        raise HTTPException(status_code=502, detail="Risk calculation service returned an incomplete factor breakdown")
    return result


@router.post("/v1/risk/evaluation", response_model=RiskReviewResponse, tags=["Risk"])
def evaluate_risk(request: RiskReviewRequest) -> RiskReviewResponse:
    try:
        configuration = get_configuration()
    except ConfigurationConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if configuration is None:
        raise HTTPException(status_code=409, detail="No saved scoring configuration is available")

    weight_values = configuration.weights.model_dump()
    service_weights: dict[str, int] = {}
    score_values: dict[str, int] = {}
    factor_details: list[tuple[str, str, str, int, int]] = []
    for factor_key, service_key, label, client_field in RISK_FACTORS:
        value = getattr(request, client_field)
        factor_scores = configuration.risk_values.get(factor_key, {})
        if value not in factor_scores:
            raise HTTPException(
                status_code=422,
                detail=f"No saved risk value is configured for {label}: {value}.",
            )
        score_values[service_key] = factor_scores[value]
        service_weights[service_key] = weight_values[factor_key]
        factor_details.append((
            service_key,
            label,
            value,
            weight_values[factor_key],
            factor_scores[value],
        ))

    calculation = _call_risk_service(
        service_weights,
        score_values,
        pep_confirmed=request.pepConfirmed,
        sanctions_match=request.sanctionsMatch,
    )
    factors = [
        RiskFactorResult(
            label=label,
            value=value,
            weight=weight,
            score=factor_score,
            contribution=calculation.contributions[service_key],
        )
        for service_key, label, value, weight, factor_score in factor_details
    ]

    return RiskReviewResponse(
        score=calculation.score,
        tier=calculation.tier,
        weightVersion=configuration.version,
        overrideReason=calculation.overrideReason,
        factors=factors,
    )



@router.get("/v1/clients/check-duplicate", response_model=DuplicateResponse, tags=["Clients"])
def check_duplicate(
    client_id: Annotated[str, Query(alias="clientId", min_length=1, max_length=100)],
    issuing_country: Annotated[str, Query(alias="issuingCountry", pattern="^[A-Z]{2}$")],
):
    document_number = client_id.strip()
    if not document_number:
        raise HTTPException(status_code=422, detail="Client ID number is required")
    return {"exists": client_exists(document_number, issuing_country)}


@router.get("/v1/clients", response_model=list[ClientOverview], tags=["Clients"])
def get_clients():
    return list_clients()


@router.post("/v1/clients", response_model=ClientCreated, status_code=201, tags=["Clients"])
def post_client(submission: ClientSubmission):
    try:
        client_id = save_client(submission)
    except DuplicateClient as exc:
        raise HTTPException(status_code=409, detail="A client with this ID number and issuing country already exists") from exc
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=422, detail="Unknown country or scoring version") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"internal_client_id": client_id}


@router.get(
    "/v1/clients/{client_id}", 
    tags=["Clients"]
)
def get_client(client_id: str):
    return {
        "message": f"Client {client_id} retrieved successfully",
    }


@router.patch(
    "/v1/clients/{client_id}", 
    tags=["Clients"]
)
def update_client(client_id: str):  
    return {
        "message": f"Client {client_id} updated successfully",
    }


@router.delete(
    "/v1/clients/{client_id}", 
    tags=["Clients"]
)
def delete_client(client_id: str):
    return {
        "message": f"Client {client_id} deleted successfully",
    }


@router.post("/v1/weights", response_model=WeightVersion, status_code=201, tags=["Weights"])
def post_weights(update: WeightUpdate):
    try:
        return {"version": save_configuration(update)}
    except ConfigurationConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def read_configuration(version: int | None = None):
    try:
        result = get_configuration(version)
    except ConfigurationConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="No saved scoring configuration for this version")
    return result


@router.get("/v1/weights/latest", response_model=ScoringConfiguration, tags=["Weights"])
def get_latest_weights():
    return read_configuration()


@router.get("/v1/weights/{version}", response_model=ScoringConfiguration, tags=["Weights"])
def get_weights(version: int):
    return read_configuration(version)


@router.post(
    "/v1/officers",
    tags=["Officers"]
)
def post_officer():
    return {
        "message": "Officer created successfully",
    }


@router.get(
    "/v1/officers/{officer_id}",
    tags=["Officers"]
)
def get_officer(officer_id: str):
    return {
        "message": f"Officer {officer_id} retrieved successfully",
    }


@router.get(
    "/v1/income-ranges",
    response_model=list[IncomeRangeResponse],
    tags=["Reference data"],
)
def read_income_ranges():
    return get_income_ranges()


@router.get(
    "/v1/professional-categories",
    response_model=list[ProfessionalCategoryResponse],
    tags=["Reference data"],
)
def read_professional_categories():
    return get_professional_categories()

@router.get(
    "/countries",
    response_model=list[CountryResponse],
    tags=["Reference data"],
)
def read_countries():
    return get_countries()
