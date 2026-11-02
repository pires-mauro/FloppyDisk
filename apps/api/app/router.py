from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from psycopg.errors import ForeignKeyViolation

from app.db.weights import ConfigurationConflict, get_configuration, save_configuration
from app.models.weight_models import ScoringConfiguration, WeightUpdate, WeightVersion
from app.db.clients import DuplicateClient, client_exists, list_clients, save_client
from app.models.client_models import ClientSubmission, ClientCreated, ClientOverview, DuplicateResponse

from app.models.model import HealthCheckResponse, IncomeRangeResponse, ProfessionalCategoryResponse, CountryResponse

from app.db.reference_data import (
    get_countries,
    get_income_ranges,
    get_professional_categories,
)

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
