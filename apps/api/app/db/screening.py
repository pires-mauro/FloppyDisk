from psycopg import Connection, OperationalError
from psycopg.errors import UndefinedTable

from app.db.connection import get_connection
from app.import_opensanctions import normalize_name
from app.models.officer_models import OfficerLoginRequest
from app.models.screening_models import ScreeningRole, ScreeningRoleUpdate
from app.officer_auth import authenticate_officer
from onboarding_shared.screening import ScreeningCandidate, ScreeningRequest, ScreeningResult, ScreeningRoleEvidence


def screen_client(request: ScreeningRequest) -> ScreeningResult:
    try:
        with get_connection() as connection:
            # Read a single committed export and policy snapshot for the whole lookup.
            connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
            snapshot = connection.execute('SELECT sha256 FROM screening_import_state').fetchone()
            if snapshot is None:
                return ScreeningResult(available=False)
            name = normalize_name(request.name)
            if not name:
                return ScreeningResult(available=False, sourceSha256=snapshot[0])
            rows = connection.execute('''
                SELECT entity_id, caption, birth_dates, nationalities, countries, datasets, topics
                FROM screening_people
                WHERE normalized_names @> ARRAY[%s]::text[]
                ORDER BY entity_id
            ''', (name,)).fetchall()
            flags = dict(connection.execute('SELECT role, red_flag FROM sanctions_roles').fetchall())
    except (OperationalError, UndefinedTable):
        return ScreeningResult(available=False)

    candidates = []
    for entity_id, caption, birth_dates, nationalities, countries, sources, topics in rows:
        # The name generates candidates. Missing or conflicting metadata is shown
        # to the officer as evidence and never silently decides identity.
        candidates.append(ScreeningCandidate(
            entityId=entity_id, name=caption, birthDates=birth_dates,
            nationalities=nationalities, countries=countries, sources=sources,
            roles=[ScreeningRoleEvidence(role=topic, redFlag=flags.get(topic)) for topic in sorted(set(topics))],
            decision=request.decisions.get(entity_id),
        ))

    birth_date = request.birthDate.isoformat()
    nationality = request.nationality.upper()
    candidates.sort(key=lambda candidate: (
        birth_date not in candidate.birthDates,
        nationality not in {country.upper() for country in candidate.nationalities},
        candidate.name.casefold(),
    ))
    return ScreeningResult(sourceSha256=snapshot[0], candidates=candidates)


def _list_roles(connection: Connection) -> list[ScreeningRole]:
    rows = connection.execute('''
        WITH known_roles AS (
            SELECT role FROM sanctions_roles
            UNION
            SELECT unnest(topics) FROM (SELECT DISTINCT topics FROM screening_people) AS topic_groups
        )
        SELECT known_roles.role, sanctions_roles.red_flag
        FROM known_roles LEFT JOIN sanctions_roles USING (role)
        ORDER BY known_roles.role
    ''').fetchall()
    return [ScreeningRole(role=role, red_flag=red_flag) for role, red_flag in rows]


def list_screening_roles(officer: OfficerLoginRequest) -> list[ScreeningRole]:
    with get_connection() as connection:
        authenticate_officer(connection, officer.officerId, officer.officerPassword.get_secret_value())
        return _list_roles(connection)


def update_screening_roles(officer: OfficerLoginRequest, update: ScreeningRoleUpdate) -> list[ScreeningRole]:
    with get_connection() as connection:
        authenticate_officer(
            connection, officer.officerId, officer.officerPassword.get_secret_value(), require_admin=True,
        )
        known_roles = {entry.role for entry in _list_roles(connection)}
        if update.updates.keys() - known_roles:
            raise ValueError('One or more roles are unknown. Reload the role list before saving.')

        rows = connection.execute('''
            INSERT INTO sanctions_roles (role, red_flag)
            SELECT role, red_flag
            FROM unnest(%s::text[], %s::boolean[]) AS changes(role, red_flag)
            ORDER BY role
            ON CONFLICT (role) DO UPDATE SET red_flag = EXCLUDED.red_flag
            RETURNING role, red_flag
        ''', (list(update.updates), list(update.updates.values()))).fetchall()
        return [ScreeningRole(role=role, red_flag=red_flag) for role, red_flag in rows]
