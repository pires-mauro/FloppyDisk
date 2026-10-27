from fastapi import APIRouter

from app.models.model import HealthCheckResponse
router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="bank-onboarding-api",
    )


@router.post("/v1/clients", tags=["Clients"])
def post_client():
    return {
        "message": "Client created successfully",
    }


@router.get("/v1/clients/{client_id}", tags=["Clients"])
def get_client(client_id: str):
    return {
        "message": f"Client {client_id} retrieved successfully",
    }


@router.patch("/v1/clients/{client_id}", tags=["Clients"])
def update_client(client_id: str):  
    return {
        "message": f"Client {client_id} updated successfully",
    }


@router.delete("/v1/clients/{client_id}", tags=["Clients"])
def delete_client(client_id: str):
    return {
        "message": f"Client {client_id} deleted successfully",
    }


@router.post("/v1/weights", tags=["Weights"])
def post_weights():
    return {
        "message": "Weights created successfully",
    }


@router.get("/v1/weights/{version}", tags=["Weights"])
def get_weights(version: str):
    return {
        "message": f"Weights version {version} retrieved successfully",
    }


@router.post("/v1/officers", tags=["Officers"])
def post_officer():
    return {
        "message": "Officer created successfully",
    }


@router.get("/v1/officers/{officer_id}", tags=["Officers"])
def get_officer(officer_id: str):
    return {
        "message": f"Officer {officer_id} retrieved successfully",
    }
