from psycopg import Connection

from app.passwords import verify_password


class OfficerAuthenticationError(Exception):
    pass


class OfficerNotAdmin(Exception):
    pass


def authenticate_officer(
    connection: Connection,
    internal_id: str,
    password: str,
    *,
    require_admin: bool = False,
) -> int:
    officer = connection.execute(
        """
        SELECT id, is_admin, password_hash
        FROM officers
        WHERE internal_id = %s
        FOR SHARE
        """,
        (internal_id,),
    ).fetchone()
    if officer is None or not verify_password(password, officer[2]):
        raise OfficerAuthenticationError("Officer ID or password is incorrect")
    if require_admin and not officer[1]:
        raise OfficerNotAdmin("Only admin officers may update weights or risk values")
    return officer[0]
