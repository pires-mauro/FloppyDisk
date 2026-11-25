import logging

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from onboarding_shared.screening import ScreeningResult, screening_outcome

from app.db.clients import copy_assessment_roles
from app.db.connection import get_connection
from app.models.risk import RiskFactorResult, RiskReviewResponse
from app.router import RISK_FACTORS, RiskServiceUnavailable, _call_risk_service

logger = logging.getLogger(__name__)

WEIGHT_COLUMNS = (
    "country_of_residence_weight, nationality_weight, tax_domicile_weight, "
    "professional_activity_weight, income_weight"
)

LATEST_PRELIMINARY_IDS_QUERY = """
    SELECT a.id
    FROM risk_assessments a
    WHERE a.preliminary
      AND NOT EXISTS (
          SELECT 1 FROM risk_assessments newer
          WHERE newer.client_id = a.client_id
            AND (newer.evaluation_time, newer.id) > (a.evaluation_time, a.id)
      )
    ORDER BY a.id
"""

LOCK_PRELIMINARY_QUERY = f"""
    SELECT a.id, a.client_id, a.officer_id, a.officer_comment, a.decision::text,
           a.weights_version, a.input_snapshot, {WEIGHT_COLUMNS},
           f.country_of_residence_risk, f.nationality_risk, f.tax_domicile_risk,
           f.professional_activity_risk, f.income_risk
    FROM risk_assessments a
    JOIN weights w ON w.version_number = a.weights_version
    JOIN evaluated_risk_factors f ON f.risk_assessment_id = a.id
    WHERE a.id = %s AND a.preliminary
      AND NOT EXISTS (
          SELECT 1 FROM risk_assessments newer
          WHERE newer.client_id = a.client_id
            AND (newer.evaluation_time, newer.id) > (a.evaluation_time, a.id)
      )
    FOR UPDATE OF a SKIP LOCKED
"""


def recalculate_preliminary_assessments() -> int:
    """Recalculate latest preliminary assessments and preserve their history."""
    with get_connection() as conn:
        assessment_ids = [row[0] for row in conn.execute(
            LATEST_PRELIMINARY_IDS_QUERY
        ).fetchall()]

    recalculated = 0
    for assessment_id in assessment_ids:
        try:
            with get_connection() as conn:
                row = conn.execute(
                    LOCK_PRELIMINARY_QUERY, (assessment_id,)
                ).fetchone()
                if row is None:
                    continue

                snapshot = dict(row[6])
                service_weights = {
                    service_key: float(row[7 + index])
                    for index, (_, service_key, _, _) in enumerate(RISK_FACTORS)
                }
                score_values = {
                    service_key: (
                        float(row[12 + index])
                        if row[12 + index] is not None else None
                    )
                    for index, (_, service_key, _, _) in enumerate(RISK_FACTORS)
                }
                calculation, preliminary = _call_risk_service(
                    service_weights,
                    score_values,
                    pep_confirmed=bool(snapshot.get("pepConfirmed", False)),
                    sanctions_match=bool(snapshot.get("sanctionsMatch", False)),
                    allow_cached_fallback=False,
                )
                if preliminary:
                    raise RuntimeError("Critical service returned a preliminary result")

                factors = [
                    RiskFactorResult(
                        label=label,
                        value=str(snapshot[client_field]),
                        weight=service_weights[service_key],
                        score=score_values[service_key],
                        contribution=calculation.contributions[service_key],
                    )
                    for _, service_key, label, client_field in RISK_FACTORS
                ]
                missing_cpi = [
                    f"{factor.label}: {factor.value}"
                    for factor in factors if factor.score is None
                ]
                override_reason = calculation.overrideReason
                previous_assessment = snapshot.get("assessment") or {}
                stored_screening = previous_assessment.get("screening")
                screening = ScreeningResult.model_validate(stored_screening) if stored_screening is not None else None
                if screening is not None:
                    calculation.tier, override_reason = screening_outcome(
                        calculation.tier, override_reason, screening,
                    )
                if missing_cpi and override_reason and override_reason.startswith("Missing CPI:"):
                    override_reason = (
                        f"Missing CPI: {', '.join(missing_cpi)}; manual review required"
                    )

                assessment = RiskReviewResponse(
                    preliminary=False,
                    scoringSource="critical",
                    scoringRuleVersion=calculation.scoringRuleVersion,
                    score=calculation.score,
                    tier=calculation.tier,
                    weightVersion=str(row[5]),
                    overrideReason=override_reason,
                    factors=factors,
                    screening=screening,
                )
                snapshot["assessment"] = assessment.model_dump(mode="json")
                snapshot["automaticReassessment"] = {
                    "previousAssessmentId": assessment_id,
                }
                new_id = conn.execute(
                    """
                    INSERT INTO risk_assessments (
                        client_id, officer_id, final_score, assigned_tier,
                        officer_comment, decision, preliminary, weights_version,
                        input_snapshot
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s, %s)
                    RETURNING id
                    """,
                    (
                        row[1], row[2], assessment.score,
                        assessment.tier.split()[0].lower(), row[3], row[4],
                        row[5], Jsonb(snapshot),
                    ),
                ).fetchone()[0]
                conn.execute(
                    """
                    INSERT INTO evaluated_risk_factors (
                        risk_assessment_id, country_of_residence_risk,
                        nationality_risk, tax_domicile_risk,
                        professional_activity_risk, income_risk
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (new_id, *(factor.score for factor in assessment.factors)),
                )
                copy_assessment_roles(conn, assessment_id, new_id)
                recalculated += 1
        except (RiskServiceUnavailable, HTTPException) as exc:
            logger.warning(
                "Could not recalculate preliminary assessment %s: %s",
                assessment_id, exc,
            )

    return recalculated
