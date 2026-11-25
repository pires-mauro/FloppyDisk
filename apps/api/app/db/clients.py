from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.db.connection import get_connection
from app.officer_auth import authenticate_officer
from app.models.client_models import ClientSubmission, ManualReviewDecision
from app.models.officer_models import OfficerLoginRequest
from app.models.risk import RiskReviewResponse


class DuplicateClient(Exception):
    pass


def copy_assessment_roles(connection: Connection, previous_id: int, new_id: int) -> None:
    connection.execute('''
        INSERT INTO risk_assessment_sanctions_roles (risk_assessment_id, role)
        SELECT %s, role FROM risk_assessment_sanctions_roles WHERE risk_assessment_id = %s
    ''', (new_id, previous_id))


def client_exists(document_number: str, issuing_country: str) -> bool:
    with get_connection() as conn:
        return conn.execute('''
            SELECT EXISTS (SELECT 1 FROM clients
                           WHERE id_number = %s AND id_issuing_country_code = %s)
        ''', (document_number, issuing_country)).fetchone()[0]


def list_clients(officer: OfficerLoginRequest | None = None):
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cursor:
        if officer is not None:
            authenticate_officer(conn, officer.officerId, officer.officerPassword.get_secret_value())
        cursor.execute('''
            SELECT c.id AS internal_client_id, c.name AS client_name,
                   CASE WHEN %s THEN c.id_number END AS document_number,
                   country.name AS issuing_country,
                   initcap(a.assigned_tier::text) || ' Risk' AS risk_tier,
                   a.decision AS final_decision, o.internal_id AS officer_id,
                   o.name AS officer_name,
                   a.preliminary,
                   a.evaluation_time AS submission_date
            FROM clients c
            JOIN countries country ON country.country_code = c.id_issuing_country_code
            JOIN LATERAL (
                SELECT assigned_tier, decision, officer_id, evaluation_time, preliminary
                FROM risk_assessments WHERE client_id = c.id
                ORDER BY evaluation_time DESC, id DESC LIMIT 1
            ) a ON TRUE
            JOIN officers o ON o.id = a.officer_id
            ORDER BY a.evaluation_time DESC, c.id DESC
        ''', (officer is not None,))
        return cursor.fetchall()


def save_client(form: ClientSubmission, assessment: RiskReviewResponse) -> int:
    with get_connection() as conn:
        # The current form sends labels; also accept numeric lookup IDs.
        income = conn.execute('''
            SELECT id, label FROM income_ranges WHERE label = %s OR id::text = %s
        ''', (str(form.annualIncome), str(form.annualIncome))).fetchone()
        profession = conn.execute('''
            SELECT id, name FROM professional_categories WHERE name = %s OR id::text = %s
        ''', (str(form.profession), str(form.profession))).fetchone()
        if not income or not profession:
            raise ValueError('Unknown income range or professional category')
        officer_id = authenticate_officer(
            conn,
            form.officerId,
            form.officerPassword.get_secret_value(),
        )

        address_id = conn.execute('''
            INSERT INTO addresses (street, house_number, postal_code, city, country_code)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (form.address.street, form.address.houseNumber, form.address.postalCode,
              form.address.city, form.countryOfResidence)).fetchone()[0]
        client = conn.execute('''
            INSERT INTO clients (name, id_number, id_issuing_country_code,
                date_of_birth, nationality_country_code, tax_domicile_country_code,
                address_id, income_range_id, professional_category_id, marital_status,
                email, dial_prefix, phone_number)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_number, id_issuing_country_code) DO NOTHING RETURNING id
        ''', (form.clientName, form.clientId, form.idIssuingCountry, form.dateOfBirth,
              form.nationality, form.taxDomicile, address_id, income[0], profession[0],
              form.maritalStatus.lower(), form.email, form.dialPrefix, form.phoneNumber)).fetchone()
        if client is None:
            raise DuplicateClient()

        snapshot = form.model_dump(mode='json', exclude={
            'finalDecision',
            'officerPassword'})
        snapshot.update(income_range_id=income[0], income_range_label=income[1],
                        professional_category_id=profession[0], professional_category=profession[1])
        snapshot['assessment'] = assessment.model_dump(mode='json')
        decision = {'approve': 'approved', 'manual_review': 'manual_review', 'decline': 'rejected'}
        assessment_id = conn.execute('''
            INSERT INTO risk_assessments (client_id, officer_id, final_score, assigned_tier,
                officer_comment, decision, preliminary, weights_version, input_snapshot)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (client[0], officer_id, assessment.score, assessment.tier.split()[0].lower(),
              form.officerComment or None, decision[form.finalDecision], assessment.preliminary, int(assessment.weightVersion),
              Jsonb(snapshot))).fetchone()[0]
        if assessment.screening is not None:
            conn.execute('''
                INSERT INTO risk_assessment_sanctions_roles (risk_assessment_id, role)
                SELECT %s, role FROM sanctions_roles WHERE role = ANY(%s::text[])
            ''', (assessment_id, sorted(assessment.screening.confirmed_roles())))
        # The server creates these five factors in this fixed order. The full
        # weights, contributions and override reason are retained in the snapshot.
        conn.execute('''
            INSERT INTO evaluated_risk_factors (
                risk_assessment_id, country_of_residence_risk, nationality_risk,
                tax_domicile_risk, professional_activity_risk, income_risk)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (assessment_id, *(factor.score for factor in assessment.factors)))
        return client[0]


def complete_manual_review(client_id: int, decision: ManualReviewDecision) -> bool:
    """Record the officer's outcome for a saved pending review without rescoring."""
    with get_connection() as conn:
        officer_id = authenticate_officer(
            conn, decision.officerId, decision.officerPassword.get_secret_value(),
        )
        # Serialize decisions for this client so a review can only be completed once.
        client = conn.execute('SELECT id FROM clients WHERE id = %s FOR UPDATE', (client_id,)).fetchone()
        if client is None:
            raise ValueError('Client does not exist')
        previous = conn.execute('''
            SELECT id, decision, input_snapshot, preliminary FROM risk_assessments
            WHERE client_id = %s
            ORDER BY evaluation_time DESC, id DESC LIMIT 1 FOR UPDATE
        ''', (client_id,)).fetchone()
        if previous is None or previous[1] != 'manual_review':
            raise ValueError('This client is not awaiting manual review')
        snapshot = dict(previous[2])
        snapshot['manualReview'] = {
            'previousAssessmentId': previous[0],
            'officerId': decision.officerId,
            'officerComment': decision.officerComment,
            'finalDecision': decision.finalDecision,
        }
        saved_id = conn.execute('''
            INSERT INTO risk_assessments (client_id, officer_id, final_score, assigned_tier,
                officer_comment, decision, preliminary, weights_version, input_snapshot)
            SELECT client_id, %s, final_score, assigned_tier, %s, %s, preliminary,
                   weights_version, %s FROM risk_assessments WHERE id = %s
            RETURNING id
        ''', (officer_id, decision.officerComment or None,
              'approved' if decision.finalDecision == 'approve' else 'rejected',
              Jsonb(snapshot), previous[0])).fetchone()[0]
        conn.execute('''
            INSERT INTO evaluated_risk_factors (
                risk_assessment_id, country_of_residence_risk, nationality_risk,
                tax_domicile_risk, professional_activity_risk, income_risk)
            SELECT %s, country_of_residence_risk, nationality_risk,
                   tax_domicile_risk, professional_activity_risk, income_risk
            FROM evaluated_risk_factors WHERE risk_assessment_id = %s
        ''', (saved_id, previous[0]))
        copy_assessment_roles(conn, previous[0], saved_id)
        return previous[3]
