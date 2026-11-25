"""Apply unapplied SQL migrations to the Compose PostgreSQL service."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


MIGRATIONS_DIR = Path(__file__).resolve().parent
MIGRATION_NAME = re.compile(r"^[0-9]+_[A-Za-z0-9_-]+\.sql$")
BASELINE = "001_schema.sql"
PSQL = [
    "docker",
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "bank_user",
    "-d",
    "bank_onboarding",
    "-v",
    "ON_ERROR_STOP=1",
]


def run_psql(*args: str, input_text: str | None = None) -> str:
    result = subprocess.run(
        [*PSQL, *args],
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="strict",
        check=True,
        capture_output=True,
        env={
            **__import__("os").environ,
            "PGCLIENTENCODING": "UTF8",
        },
    )
    return result.stdout.strip()


def initialize_history() -> None:
    run_psql(
        "-c",
        "CREATE TABLE IF NOT EXISTS public.schema_migrations ("
        "version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    )

    legacy_schema_exists = run_psql(
        "-At",
        "-c",
        "SELECT to_regclass('public.clients') IS NOT NULL AND NOT EXISTS ("
        f"SELECT 1 FROM public.schema_migrations WHERE version = '{BASELINE}')",
    )
    if legacy_schema_exists == "t":
        raise ValueError(
            "This database predates the consolidated migration baseline. "
            "Use a fresh development PostgreSQL volume to apply it."
        )


def main() -> int:
    try:
        initialize_history()
        # New numbered SQL files are discovered automatically; keep no
        # separate migration registry to maintain.
        migrations = sorted(
            path
            for path in MIGRATIONS_DIR.glob("*.sql")
            if MIGRATION_NAME.fullmatch(path.name)
        )

        for migration in migrations:
            # psql does not bind parameters; migration names are constrained to
            # the filename pattern above, so this literal is safe to interpolate.
            applied = run_psql(
                "-At",
                "-c",
                "SELECT EXISTS (SELECT 1 FROM public.schema_migrations "
                f"WHERE version = '{migration.name}')",
            )
            if applied == "t":
                print(f"Already applied: {migration.name}")
                continue

            print(f"Applying: {migration.name}")
            sql = migration.read_text(encoding="utf-8")
            run_psql(
                "--single-transaction",
                "-f",
                "-",
                input_text=f"{sql}\nINSERT INTO public.schema_migrations (version) VALUES ('{migration.name}');\n",
            )

        print("Database migrations are up to date.")
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        else:
            print(f"Migration failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
