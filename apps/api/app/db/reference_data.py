from psycopg.rows import dict_row

from app.db.connection import get_connection


def get_income_ranges():
    with get_connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT id, label FROM income_ranges ORDER BY lower_bound"
            )
            return cursor.fetchall()


def get_professional_categories():
    with get_connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT id, name FROM professional_categories ORDER BY id"
            )
            return cursor.fetchall()


def get_countries():
    with get_connection() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "SELECT country_code AS code, name FROM countries ORDER BY name"
            )
            return cursor.fetchall()
