from psycopg import Connection

from app.db.connection import get_connection
from app.models.officer_models import OfficerLoginRequest
from app.models.screening_models import ScreeningRole, ScreeningRoleUpdate
from app.officer_auth import authenticate_officer


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


def update_screening_roles(update: ScreeningRoleUpdate) -> list[ScreeningRole]:
    with get_connection() as connection:
        authenticate_officer(
            connection, update.officerId, update.officerPassword.get_secret_value(), require_admin=True,
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
