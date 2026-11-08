import os
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS weight_configuration (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(10) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def merge_weight_values(
    current_weights: dict[str, int],
    current_risk_values: dict[str, dict[str, int]],
    weights: dict[str, int] | None,
    risk_values: dict[str, dict[str, int | None]] | None,
) -> tuple[dict[str, int], dict[str, dict[str, int]]]:
    merged_weights = dict(current_weights)
    merged_risk_values = {
        factor: dict(values) for factor, values in current_risk_values.items()
    }

    if weights is not None:
        merged_weights.update(weights)
    if risk_values is not None:
        for factor, choices in risk_values.items():
            saved_choices = merged_risk_values.setdefault(factor, {})
            for choice, risk in choices.items():
                if risk is None:
                    saved_choices.pop(choice, None)
                else:
                    saved_choices[choice] = risk
            if not saved_choices:
                merged_risk_values.pop(factor, None)

    return merged_weights, merged_risk_values


def _connect() -> psycopg.Connection[dict[str, Any]]:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg.connect(database_url, row_factory=dict_row)


def get_latest_weights() -> dict[str, Any] | None:
    with _connect() as connection:
        connection.execute(_CREATE_TABLE)
        row = connection.execute(
            """
            SELECT version, weights, risk_values
            FROM weight_configuration
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        return None

    return {
        "version": str(row["version"]),
        "weights": row["weights"],
        "risk_values": row["risk_values"],
    }


def update_weights(
    employee_id: str,
    weights: dict[str, int] | None,
    risk_values: dict[str, dict[str, int | None]] | None,
) -> dict[str, Any]:
    with _connect() as connection:
        connection.execute(_CREATE_TABLE)
        connection.execute("SELECT pg_advisory_xact_lock(1)")
        row = connection.execute(
            """
            SELECT version, weights, risk_values
            FROM weight_configuration
            WHERE id = 1
            FOR UPDATE
            """
        ).fetchone()

        stored_weights = dict(row["weights"]) if row else {}
        stored_risk_values = (
            {factor: dict(values) for factor, values in row["risk_values"].items()}
            if row
            else {}
        )
        current_weights, current_risk_values = merge_weight_values(
            stored_weights,
            stored_risk_values,
            weights,
            risk_values,
        )

        version = row["version"] + 1 if row else 1
        connection.execute(
            """
            INSERT INTO weight_configuration (
                id, version, weights, risk_values, updated_by
            )
            VALUES (1, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                version = EXCLUDED.version,
                weights = EXCLUDED.weights,
                risk_values = EXCLUDED.risk_values,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
            """,
            (
                version,
                Jsonb(current_weights),
                Jsonb(current_risk_values),
                employee_id,
            ),
        )

    return {
        "version": str(version),
        "weights": current_weights,
        "risk_values": current_risk_values,
    }
