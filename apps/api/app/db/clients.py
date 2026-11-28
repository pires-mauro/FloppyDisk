from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import TypeAdapter, ValidationError
from onboarding_shared.screening import ScreeningResult

from app.db.connection import get_connection
from app.officer_auth import authenticate_officer
from app.models.client_models import ClientAddress, ClientSubmission, ManualReviewDecision, SavedClientProfile
from app.models.officer_models import OfficerLoginRequest
from app.models.risk import RiskFactorResult, RiskReviewResponse, SavedClientReview


class DuplicateClient(Exception):
    pass


_FACTOR_DETAILS = TypeAdapter(list[RiskFactorResult])


def get_saved_client_review(client_id: int, officer: OfficerLoginRequest) -> SavedClientReview | None:
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cursor:
        authenticate_officer(conn, officer.officerId, officer.officerPassword.get_secret_value())
        row = cursor.execute('''
            SELECT c.id AS client_id, c.name, c.id_number, c.date_of_birth, c.marital_status::text,
                   c.email, c.dial_prefix, c.phone_number,
                   issuing.name AS issuing_country, nationality.name AS nationality,
                   domicile.name AS tax_domicile, residence.name AS residence,
                   address.street, address.house_number, address.city, address.postal_code,
                   income.label AS income, profession.name AS profession,
                   a.id AS assessment_id, a.decision::text, a.final_score,
                   initcap(a.assigned_tier::text) || ' Risk' AS tier, a.preliminary,
                   a.weights_version, a.evaluation_time, a.officer_comment,
                   reviewer.internal_id AS officer_id, reviewer.name AS officer_name,
                   a.input_snapshot -> 'assessment' AS saved_assessment,
                   ARRAY[w.country_of_residence_weight, w.nationality_weight, w.tax_domicile_weight,
                         w.income_weight, w.professional_activity_weight] AS weights,
                   CASE WHEN f.risk_assessment_id IS NOT NULL THEN
                       ARRAY[f.country_of_residence_risk, f.nationality_risk, f.tax_domicile_risk,
                             f.income_risk, f.professional_activity_risk]
                   END AS factor_scores,
                   ARRAY(SELECT role FROM risk_assessment_sanctions_roles
                         WHERE risk_assessment_id = a.id ORDER BY role) AS saved_roles
            FROM clients c
            JOIN addresses address ON address.id = c.address_id
            JOIN countries issuing ON issuing.country_code = c.id_issuing_country_code
            JOIN countries nationality ON nationality.country_code = c.nationality_country_code
            JOIN countries domicile ON domicile.country_code = c.tax_domicile_country_code
            JOIN countries residence ON residence.country_code = address.country_code
            JOIN income_ranges income ON income.id = c.income_range_id
            JOIN professional_categories profession ON profession.id = c.professional_category_id
            JOIN LATERAL (
                SELECT * FROM risk_assessments WHERE client_id = c.id
                ORDER BY evaluation_time DESC, id DESC LIMIT 1
            ) a ON TRUE
            JOIN officers reviewer ON reviewer.id = a.officer_id
            JOIN weights w ON w.version_number = a.weights_version
            LEFT JOIN evaluated_risk_factors f ON f.risk_assessment_id = a.id
            WHERE c.id = %s
        ''', (client_id,)).fetchone()
    if row is None:
        return None

    assessment = row['saved_assessment']
    if not isinstance(assessment, dict):
        assessment = {}
    try:
        factors = _FACTOR_DETAILS.validate_python(assessment.get('factors', []))
    except ValidationError:
        factors = []
    if not factors and row['factor_scores'] is not None:
        # Older rows retain the evaluated scores and the saved weight version.
        # Their individual contributions may never have been recorded.
        factor_values = (
            ('Country of residence', row['residence']),
            ('Nationality', row['nationality']),
            ('Tax domicile', row['tax_domicile']),
            ('Income', row['income']),
            ('Professional activity', row['profession']),
        )
        factors = [
            RiskFactorResult(label=label, value=value, weight=weight, score=score, contribution=None)
            for (label, value), weight, score in zip(factor_values, row['weights'], row['factor_scores'], strict=True)
        ]
    try:
        screening = ScreeningResult.model_validate(assessment['screening']) if assessment.get('screening') else None
    except ValidationError:
        screening = None

    reason = assessment.get('overrideReason')
    rule_version = assessment.get('scoringRuleVersion')
    return SavedClientReview(
        clientId=row['client_id'],
        assessmentId=row['assessment_id'],
        profile=SavedClientProfile(
            name=row['name'], documentNumber=row['id_number'], issuingCountry=row['issuing_country'],
            dateOfBirth=row['date_of_birth'], nationality=row['nationality'], taxDomicile=row['tax_domicile'],
            countryOfResidence=row['residence'],
            address=ClientAddress(street=row['street'], houseNumber=row['house_number'],
                                  postalCode=row['postal_code'], city=row['city']),
            income=row['income'], profession=row['profession'], maritalStatus=row['marital_status'],
            email=row['email'], phone=f"{row['dial_prefix']} {row['phone_number']}",
        ),
        decision=row['decision'], tier=row['tier'], score=row['final_score'], preliminary=row['preliminary'],
        weightVersion=row['weights_version'], scoringRuleVersion=rule_version if isinstance(rule_version, str) else None,
        reviewReason=reason if isinstance(reason, str) else None,
        evaluatedAt=row['evaluation_time'], officerId=row['officer_id'], officerName=row['officer_name'],
        officerComment=row['officer_comment'], factors=factors, screening=screening, savedRoles=row['saved_roles'],
    )


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


def list_clients(officer: OfficerLoginRequest):
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cursor:
        authenticate_officer(conn, officer.officerId, officer.officerPassword.get_secret_value())
        cursor.execute('''
            SELECT c.id AS internal_client_id, c.name AS client_name,
                   c.id_number AS document_number,
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
        ''')
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
        client = conn.execute('SELECT id FROM clients WHERE id = %s FOR NO KEY UPDATE', (client_id,)).fetchone()
        if client is None:
            raise ValueError('Client does not exist')
        previous = conn.execute('''
            SELECT id, decision, input_snapshot, preliminary FROM risk_assessments
            WHERE client_id = %s
            ORDER BY evaluation_time DESC, id DESC LIMIT 1 FOR UPDATE
        ''', (client_id,)).fetchone()
        if previous is None or previous[1] != 'manual_review':
            raise ValueError('This client is not awaiting manual review')
        if decision.assessmentId is not None and decision.assessmentId != previous[0]:
            raise ValueError('The saved assessment changed. Reload the review details before deciding.')
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
