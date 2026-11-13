from app.db.connection import get_connection
from app.officer_auth import authenticate_officer
from app.models.weight_models import FactorWeights, ScoringConfiguration, WeightUpdate


# Only these fixed identifiers are interpolated into SQL. All request values
# are passed as query parameters.
# API key: (rule table, rule FK, lookup table, lookup PK, frontend choice)
RULES = {
    'country_weight': ('country_of_residence_risk', 'country_code', 'countries', 'country_code', 'country_code'),
    'nationality_weight': ('nationality_risk', 'country_code', 'countries', 'country_code', 'country_code'),
    'tax_domicile_weight': ('tax_domicile_risk', 'country_code', 'countries', 'country_code', 'country_code'),
    'professional_activity_weight': ('professional_activity_risk', 'professional_category_id',
                                     'professional_categories', 'id', 'name'),
    'income_weight': ('income_risk', 'income_range_id', 'income_ranges', 'id', 'label'),
}

WEIGHT_COLUMNS = ('country_of_residence_weight, nationality_weight, tax_domicile_weight, '
                  'professional_activity_weight, income_weight')


class ConfigurationConflict(Exception):
    pass


def get_configuration(version: int | None = None):
    with get_connection() as conn:
        query = f'SELECT version_number, {WEIGHT_COLUMNS} FROM weights'
        if version is None:
            row = conn.execute(query + ' ORDER BY version_number DESC LIMIT 1').fetchone()
        else:
            row = conn.execute(query + ' WHERE version_number = %s', (version,)).fetchone()
        if row is None:
            return None

        if any(not 1 <= value <= 5 for value in row[1:]):
            raise ConfigurationConflict('Stored weights must be between 1 and 5 for the frontend')
        risk_values = {}
        for key, (table, fk, lookup, pk, label) in RULES.items():
            rows = conn.execute(f'''
                SELECT l.{label}, r.risk_score FROM {table} r
                JOIN {lookup} l ON l.{pk} = r.{fk} WHERE r.weights_version = %s
                ORDER BY l.{label}
            ''', (row[0],)).fetchall()
            values = {}
            for choice, score in rows:
                if score != int(score) or not 1 <= score <= 5:
                    raise ConfigurationConflict(f'Stored risk for {key}/{choice} must be an integer from 1 to 5')
                values[choice] = int(score)
            risk_values[key] = values
        return ScoringConfiguration(version=str(row[0]),
                                    weights=FactorWeights(**dict(zip(RULES, row[1:]))),
                                    risk_values=risk_values)


def save_configuration(update: WeightUpdate) -> str:
    with get_connection() as conn:
        officer_id = authenticate_officer(
            conn,
            update.employee_id,
            update.password.get_secret_value(),
            require_admin=True,
        )

        # Serialize saves, including the first save when there is no row to lock.
        conn.execute('LOCK TABLE weights IN SHARE ROW EXCLUSIVE MODE')
        previous = conn.execute(f'SELECT version_number, {WEIGHT_COLUMNS} FROM weights '
                                'ORDER BY version_number DESC LIMIT 1').fetchone()
        if update.weights:
            values = tuple(getattr(update.weights, key) for key in RULES)
        elif previous:
            values = previous[1:]
        else:
            raise ConfigurationConflict('Save all five weights before editing risk values')

        version = conn.execute(f'''
            INSERT INTO weights ({WEIGHT_COLUMNS}, created_by_officer_id)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING version_number
        ''', (*values, officer_id)).fetchone()[0]

        for key, (table, fk, lookup, pk, label) in RULES.items():
            if previous:
                conn.execute(f'''
                    INSERT INTO {table} (weights_version, {fk}, risk_score)
                    SELECT %s, {fk}, risk_score FROM {table} WHERE weights_version = %s
                ''', (version, previous[0]))
            changes = (update.risk_values or {}).get(key, {})
            if not changes:
                continue
            choices = dict(conn.execute(
                f'SELECT {label} AS choice, {pk} AS lookup_id FROM {lookup} WHERE {label} = ANY(%s)',
                (list(changes),)).fetchall())
            for choice, rating in changes.items():
                if choice not in choices:
                    raise ValueError(f'Unknown choice for {key}: {choice}')
                choice_id = choices[choice]
                if rating is None:
                    conn.execute(f'DELETE FROM {table} WHERE weights_version = %s AND {fk} = %s',
                                 (version, choice_id))
                else:
                    conn.execute(f'''
                        INSERT INTO {table} (weights_version, {fk}, risk_score) VALUES (%s, %s, %s)
                        ON CONFLICT (weights_version, {fk}) DO UPDATE SET risk_score = EXCLUDED.risk_score
                    ''', (version, choice_id, rating))
        return str(version)
