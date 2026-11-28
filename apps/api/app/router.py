import json
import logging
import os
from typing import Annotated
from urllib.error import HTTPError as URLHTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Path, Query, Response, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError
from psycopg.errors import ForeignKeyViolation
from onboarding_shared.scoring import calculate_risk
from onboarding_shared.models import ErrorResponse, RiskEvaluationRequest, ValidationErrorResponse
from onboarding_shared.screening import ScreeningRequest, ScreeningResult, screening_outcome

from app.db.clients import (
    DuplicateClient,
    client_exists,
    list_clients,
    save_client,
    complete_manual_review,
    get_saved_client_review,
)
from app.db.reference_data import (
    get_countries,
    get_income_ranges,
    get_professional_categories,
)
from app.db.screening import list_screening_roles, screen_client, update_screening_roles
from app.db.weights import (
    ConfigurationConflict,
    get_configuration,
    save_configuration,
)
from app.db.connection import get_connection
from app.models.client_models import (
    ClientSubmission,
    DuplicateResponse,
    ManualReviewDecision,
    ClientDecisionSaved,
    OfficerClientOverview,
)
from app.models.health_models import HealthCheckResponse
from app.models.officer_models import OfficerLoginRequest, OfficerLoginResponse
from app.models.reference_data_models import (
    CountryResponse,
    IncomeRangeResponse,
    ProfessionalCategoryResponse,
)
from app.models.risk import (
    OfficerRiskReviewRequest,
    RiskCalculationResult,
    RiskFactorResult,
    RiskReviewRequest,
    RiskReviewResponse,
    SavedClientReview,
    FinalizedClient,
)
from app.models.screening_models import ScreeningRole, ScreeningRoleUpdate
from app.models.weight_models import ScoringConfiguration, WeightUpdate, WeightVersion
from app.officer_auth import (
    OfficerAuthenticationError,
    OfficerNotAdmin,
    authenticate_officer,
)
from app.officer_http_auth import OfficerBasicAuth
from app.screening_auth import issue_token, verify_token

logger = logging.getLogger(__name__)
router = APIRouter()
screening_bearer = HTTPBearer(
    auto_error=False,
    scheme_name="ScreeningCallback",
    description="Short-lived credential issued by the onboarding API for this exact screening request.",
)
officer_basic = OfficerBasicAuth(
    scheme_name="OfficerBasic",
    description="Officer ID and password for the screening role settings.",
    realm="FloppyDisk",
)

_INVALID_OFFICER = {"model": ErrorResponse, "description": "Officer credentials are invalid."}
_ADMIN_REQUIRED = {"model": ErrorResponse, "description": "An admin officer is required."}
_INVALID_INPUT = {"model": ErrorResponse | ValidationErrorResponse, "description": "Invalid request or input values."}
_RISK_ERRORS = {
    401: _INVALID_OFFICER,
    409: {"model": ErrorResponse, "description": "The scoring configuration is unavailable or inconsistent."},
    422: _INVALID_INPUT,
    502: {"model": ErrorResponse, "description": "The scoring service returned an error or an invalid result."},
}


class RiskServiceUnavailable(Exception):
    pass


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    summary="Check onboarding API health",
)
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="bank-onboarding-api",
    )


@router.post(
    "/v1/officers/login",
    response_model=OfficerLoginResponse,
    tags=["Officers"],
    summary="Sign in an officer",
    responses={401: _INVALID_OFFICER},
)
def login_officer(request: OfficerLoginRequest) -> OfficerLoginResponse:
    try:
        with get_connection() as conn:
            officer_id = authenticate_officer(
                conn,
                request.officerId,
                request.officerPassword.get_secret_value(),
            )
            officer = conn.execute(
                "SELECT internal_id, is_admin FROM officers WHERE id = %s",
                (officer_id,),
            ).fetchone()
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return OfficerLoginResponse(officerId=officer[0], isAdmin=officer[1])


RISK_FACTORS = (
    ("country_weight", "country_of_residence", "Country of residence", "countryOfResidence"),
    ("nationality_weight", "nationality", "Nationality", "nationality"),
    ("tax_domicile_weight", "tax_domicile", "Tax domicile", "taxDomicile"),
    ("professional_activity_weight", "profession", "Professional activity", "profession"),
    ("income_weight", "income", "Annual income", "annualIncome"),
)


def _call_risk_service(
    weights: dict[str, float],
    scores: dict[str, float | None],
    *,
    pep_confirmed: bool = False,
    sanctions_match: bool = False,
    allow_cached_fallback: bool = True,
    screening_request: ScreeningRequest | None = None,
) -> tuple[RiskCalculationResult, bool]:
    base_url = os.environ.get("RISK_SERVICE_URL", "http://critical:8000").rstrip("/")
    request = Request(
        f"{base_url}/v1/evaluation/",
        data=RiskEvaluationRequest(
            weights=weights, scores=scores,
            pepConfirmed=pep_confirmed, sanctionsMatch=sanctions_match,
            screeningRequest=screening_request,
            screeningToken=issue_token(screening_request) if screening_request is not None else None,
        ).model_dump_json().encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except URLHTTPError as exc:
        logger.warning("Risk service returned HTTP %s", exc.code)
        if 500 <= exc.code < 600:
            if not allow_cached_fallback:
                raise RiskServiceUnavailable("Risk calculation service returned a server error") from exc
            return _cached_risk(weights, scores, pep_confirmed, sanctions_match, screening_request)
        raise HTTPException(status_code=502, detail="Risk calculation service returned an error") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Risk service is unavailable: %s", exc)
        if not allow_cached_fallback:
            raise RiskServiceUnavailable("Risk calculation service is unavailable") from exc
        return _cached_risk(weights, scores, pep_confirmed, sanctions_match, screening_request)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.warning("Risk service returned an invalid response")
        raise HTTPException(status_code=502, detail="Risk calculation service returned an invalid response") from exc

    try:
        result = RiskCalculationResult.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="Risk calculation service returned an invalid evaluation") from exc
    if result.contributions.keys() != weights.keys():
        raise HTTPException(status_code=502, detail="Risk calculation service returned an incomplete factor breakdown")
    if screening_request is not None and result.screening is None:
        if allow_cached_fallback:
            return _cached_risk(weights, scores, pep_confirmed, sanctions_match, screening_request)
        raise RiskServiceUnavailable("Risk calculation service did not return screening results")
    return result, False


def _cached_risk(
    weights, scores, pep_confirmed, sanctions_match, screening_request: ScreeningRequest | None = None,
) -> tuple[RiskCalculationResult, bool]:
    logger.warning('Using bundled scoring rules; assessment will be preliminary')
    result = RiskCalculationResult.model_validate(calculate_risk(
        weights, scores, pep_confirmed=pep_confirmed, sanctions_match=sanctions_match,
    ))
    if screening_request is not None:
        result.screening = screen_client(screening_request)
        result.tier, result.overrideReason = screening_outcome(result.tier, result.overrideReason, result.screening)
    return result, True


@router.post(
    "/internal/screening",
    response_model=ScreeningResult,
    tags=["Internal"],
    summary="Look up watchlist candidates for the scoring service",
    responses={401: {"model": ErrorResponse, "description": "The screening callback credential is missing or invalid."}},
)
def screening_callback(
    request: ScreeningRequest,
    credential: Annotated[HTTPAuthorizationCredentials | None, Security(screening_bearer)],
) -> ScreeningResult:
    if credential is None or not verify_token(request, credential.credentials):
        raise HTTPException(status_code=401, detail="Invalid screening callback credential")
    return screen_client(request)


@router.post(
    "/v1/risk/evaluation", response_model=RiskReviewResponse, tags=["Risk"],
    summary="Evaluate onboarding risk and screen the client", responses=_RISK_ERRORS,
)
@router.post(
    "/v1/risk/screening/confirm", response_model=RiskReviewResponse, tags=["Risk"],
    summary="Reevaluate risk after an officer resolves screening candidates", responses=_RISK_ERRORS,
)
def evaluate_risk(request: OfficerRiskReviewRequest) -> RiskReviewResponse:
    try:
        with get_connection() as connection:
            authenticate_officer(connection, request.officerId, request.officerPassword.get_secret_value())
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return _evaluate_risk(request)


def _evaluate_risk(request: RiskReviewRequest) -> RiskReviewResponse:
    try:
        configuration = get_configuration()
    except ConfigurationConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if configuration is None:
        raise HTTPException(status_code=409, detail="No saved scoring configuration is available")

    weight_values = configuration.weights.model_dump()
    service_weights: dict[str, float] = {}
    score_values: dict[str, float | None] = {}
    factor_details: list[tuple[str, str, str, float, float | None]] = []
    for factor_key, service_key, label, client_field in RISK_FACTORS:
        value = getattr(request, client_field)
        factor_scores = configuration.risk_values.get(factor_key, {})
        if value not in factor_scores and service_key not in {'country_of_residence', 'nationality', 'tax_domicile'}:
            raise HTTPException(
                status_code=422,
                detail=f"No saved risk value is configured for {label}: {value}.",
            )
        score_values[service_key] = factor_scores.get(value)
        service_weights[service_key] = weight_values[factor_key]
        factor_details.append((
            service_key,
            label,
            value,
            weight_values[factor_key],
            factor_scores.get(value),
        ))

    calculation, preliminary = _call_risk_service(
        service_weights,
        score_values,
        screening_request=ScreeningRequest(
            name=request.clientName, birthDate=request.dateOfBirth, nationality=request.nationality,
            decisions=request.screeningDecisions,
        ),
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
    missing_cpi = [f'{label}: {value}' for _, label, value, _, score in factor_details if score is None]
    override_reason = calculation.overrideReason
    if missing_cpi and override_reason and override_reason.startswith('Missing CPI:'):
        override_reason = f'Missing CPI: {", ".join(missing_cpi)}; manual review required'

    assessment = RiskReviewResponse(
        preliminary=preliminary,
        scoringSource='cached' if preliminary else 'critical',
        scoringRuleVersion=calculation.scoringRuleVersion,
        score=calculation.score,
        tier=calculation.tier,
        weightVersion=configuration.version,
        overrideReason=override_reason,
        factors=factors,
        screening=calculation.screening,
    )
    return assessment



@router.get(
    "/v1/clients/check-duplicate", response_model=DuplicateResponse, tags=["Clients"],
    summary="Check whether a document number and issuing country already exist",
    responses={422: _INVALID_INPUT},
)
def check_duplicate(
    client_id: Annotated[str, Query(alias="clientId", min_length=1, max_length=100)],
    issuing_country: Annotated[str, Query(alias="issuingCountry", pattern="^[A-Z]{2}$")],
):
    document_number = client_id.strip()
    if not document_number:
        raise HTTPException(status_code=422, detail="Client ID number is required")
    return {"exists": client_exists(document_number, issuing_country)}


@router.post(
    "/v1/clients/overview", response_model=list[OfficerClientOverview], tags=["Clients"],
    summary="List client records with document numbers for a signed-in officer",
    responses={401: _INVALID_OFFICER},
)
def get_officer_client_overview(officer: OfficerLoginRequest):
    try:
        return list_clients(officer)
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post(
    "/v1/clients", response_model=FinalizedClient, status_code=201, tags=["Clients"],
    summary="Save an onboarding decision and its assessment",
    responses={
        **_RISK_ERRORS,
        409: {"model": ErrorResponse, "description": "Duplicate client, unresolved screening, or a conflicting assessment or decision."},
    },
)
def post_client(submission: ClientSubmission):
    try:
        with get_connection() as connection:
            authenticate_officer(connection, submission.officerId, submission.officerPassword.get_secret_value())
        assessment = _evaluate_risk(RiskReviewRequest.model_validate(submission.model_dump()))
        expected_decision = {
            'Low Risk': 'approve', 'Medium Risk': 'manual_review', 'High Risk': 'decline',
        }[assessment.tier]
        if submission.finalDecision != expected_decision:
            raise HTTPException(
                status_code=409,
                detail='The recalculated risk tier requires a different decision. Refresh the risk assessment and review it again.',
            )
        if submission.finalDecision != 'decline' and (
            assessment.screening is None or assessment.screening.requires_confirmation()
        ):
            raise HTTPException(status_code=409, detail='Resolve the screening matches before recording a decision.')
        client_id = save_client(submission, assessment)
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DuplicateClient as exc:
        raise HTTPException(status_code=409, detail="A client with this ID number and issuing country already exists") from exc
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=422, detail="Unknown country or scoring version") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return FinalizedClient(
        **assessment.model_dump(),
        internal_client_id=client_id,
        finalDecision=submission.finalDecision,
    )


@router.post(
    "/v1/clients/{client_id}/decision", response_model=ClientDecisionSaved, tags=["Clients"],
    summary="Complete a pending manual review",
    responses={
        401: _INVALID_OFFICER,
        409: {"model": ErrorResponse, "description": "The client is missing, the review is complete, or the assessment changed."},
    },
)
def submit_manual_review(client_id: int, decision: ManualReviewDecision):
    try:
        preliminary = complete_manual_review(client_id, decision)
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ClientDecisionSaved(
        internal_client_id=client_id,
        finalDecision=decision.finalDecision,
        preliminary=preliminary,
    )


@router.post(
    "/v1/clients/{client_id}/details", response_model=SavedClientReview, tags=["Clients"],
    summary="Get the client profile and saved assessment evidence",
    responses={
        401: _INVALID_OFFICER,
        404: {"model": ErrorResponse, "description": "No saved assessment was found for this client."},
    },
)
def get_client_details(client_id: Annotated[int, Path(gt=0)], officer: OfficerLoginRequest, response: Response):
    try:
        review = get_saved_client_review(client_id, officer)
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    if review is None:
        raise HTTPException(status_code=404, detail="No saved assessment was found for this client")
    response.headers["Cache-Control"] = "no-store"
    return review


@router.post(
    "/v1/weights", response_model=WeightVersion, status_code=201, tags=["Weights"],
    summary="Save a new scoring configuration version",
    responses={
        401: _INVALID_OFFICER,
        403: _ADMIN_REQUIRED,
        409: {"model": ErrorResponse, "description": "The saved scoring configuration is inconsistent."},
        422: _INVALID_INPUT,
    },
)
def post_weights(update: WeightUpdate):
    try:
        return {"version": save_configuration(update)}
    except OfficerAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except OfficerNotAdmin as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ConfigurationConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/v1/screening/roles", response_model=list[ScreeningRole], tags=["Screening"],
    summary="List screening roles and their saved flags", responses={401: _INVALID_OFFICER},
)
def get_screening_roles(officer: Annotated[OfficerLoginRequest, Security(officer_basic)], response: Response):
    try:
        roles = list_screening_roles(officer)
    except OfficerAuthenticationError as exc:
        raise officer_basic.make_not_authenticated_error() from exc
    response.headers["Cache-Control"] = "no-store"
    return roles


@router.put(
    "/v1/screening/roles", response_model=list[ScreeningRole], tags=["Screening"],
    summary="Update screening flags for the requested roles",
    responses={401: _INVALID_OFFICER, 403: _ADMIN_REQUIRED, 422: _INVALID_INPUT},
)
def put_screening_roles(update: ScreeningRoleUpdate, officer: Annotated[OfficerLoginRequest, Security(officer_basic)]):
    try:
        return update_screening_roles(officer, update)
    except OfficerAuthenticationError as exc:
        raise officer_basic.make_not_authenticated_error() from exc
    except OfficerNotAdmin as exc:
        raise HTTPException(status_code=403, detail="Only admin officers may update role flags") from exc
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


_CONFIGURATION_ERRORS = {
    404: {"model": ErrorResponse, "description": "No scoring configuration was found."},
    409: {"model": ErrorResponse, "description": "The saved scoring configuration is inconsistent."},
}


@router.get(
    "/v1/weights/latest", response_model=ScoringConfiguration, tags=["Weights"],
    summary="Get the latest scoring configuration", responses=_CONFIGURATION_ERRORS,
)
def get_latest_weights():
    return read_configuration()


@router.get(
    "/v1/weights/{version}", response_model=ScoringConfiguration, tags=["Weights"],
    summary="Get a saved scoring configuration by version", responses=_CONFIGURATION_ERRORS,
)
def get_weights(version: int):
    return read_configuration(version)


@router.get(
    "/v1/income-ranges",
    response_model=list[IncomeRangeResponse],
    tags=["Reference data"],
    summary="List available income ranges",
)
def read_income_ranges():
    return get_income_ranges()


@router.get(
    "/v1/professional-categories",
    response_model=list[ProfessionalCategoryResponse],
    tags=["Reference data"],
    summary="List available professional categories",
)
def read_professional_categories():
    return get_professional_categories()

@router.get(
    "/countries",
    response_model=list[CountryResponse],
    tags=["Reference data"],
    summary="List available countries",
)
def read_countries():
    return get_countries()
