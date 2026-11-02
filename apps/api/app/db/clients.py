from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.db.connection import get_connection
from app.models.client_models import ClientSubmission


class DuplicateClient(Exception):
    pass


def client_exists(document_number: str, issuing_country: str) -> bool:
    with get_connection() as conn:
        return conn.execute('''
            SELECT EXISTS (SELECT 1 FROM clients
                           WHERE id_number = %s AND id_issuing_country_code = %s)
        ''', (document_number, issuing_country)).fetchone()[0]


def list_clients():
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute('''
            SELECT c.id AS internal_client_id, c.name AS client_name,
                   country.name AS issuing_country,
                   initcap(a.assigned_tier::text) || ' Risk' AS risk_tier,
                   a.decision AS final_decision, o.internal_id AS officer_id,
                   a.evaluation_time AS submission_date
            FROM clients c
            JOIN countries country ON country.country_code = c.id_issuing_country_code
            JOIN LATERAL (
                SELECT assigned_tier, decision, officer_id, evaluation_time
                FROM risk_assessments WHERE client_id = c.id AND NOT preliminary
                ORDER BY evaluation_time DESC, id DESC LIMIT 1
            ) a ON TRUE
            JOIN officers o ON o.id = a.officer_id
            ORDER BY a.evaluation_time DESC, c.id DESC
        ''')
        return cursor.fetchall()


def save_client(form: ClientSubmission) -> int:
    with get_connection() as conn:
        # The current form sends labels; also accept numeric lookup IDs.
        income = conn.execute('''
            SELECT id, label FROM income_ranges WHERE label = %s OR id::text = %s
        ''', (str(form.annualIncome), str(form.annualIncome))).fetchone()
        profession = conn.execute('''
            SELECT id, name FROM professional_categories WHERE name = %s OR id::text = %s
        ''', (str(form.profession), str(form.profession))).fetchone()
        officer = conn.execute('SELECT id FROM officers WHERE internal_id = %s',
                               (form.officerId,)).fetchone()
        if not income or not profession:
            raise ValueError('Unknown income range or professional category')
        if not officer:
            raise ValueError('Officer ID does not exist')

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
            'riskScore', 'riskTier', 'finalDecision', 'weightVersion'})
        snapshot.update(income_range_id=income[0], income_range_label=income[1],
                        professional_category_id=profession[0], professional_category=profession[1])
        decision = {'approve': 'approved', 'manual_review': 'manual_review', 'decline': 'rejected'}
        conn.execute('''
            INSERT INTO risk_assessments (client_id, officer_id, final_score, assigned_tier,
                officer_comment, decision, preliminary, weights_version, input_snapshot)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s, %s)
        ''', (client[0], officer[0], form.riskScore, form.riskTier.split()[0].lower(),
              form.officerComment or None, decision[form.finalDecision], form.weightVersion,
              Jsonb(snapshot)))
        return client[0]
