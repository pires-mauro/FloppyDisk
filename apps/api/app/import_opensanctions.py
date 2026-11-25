"""Load a complete FollowTheMoney JSON-lines export."""

import argparse
import hashlib
import json
import sys
import unicodedata
from pathlib import Path
from typing import BinaryIO

from app.db.connection import get_connection


def normalize_name(value: str) -> str:
    text = unicodedata.normalize('NFKC', value).casefold()
    return ' '.join(''.join(char if char.isalnum() else ' ' for char in text).split())


def import_people(source: BinaryIO, *, expected_sha256: str | None = None) -> int | None:
    imported = 0
    checksum = hashlib.sha256()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute('LOCK TABLE screening_import_state IN SHARE ROW EXCLUSIVE MODE')
        if expected_sha256 is not None:
            previous = cursor.execute('SELECT sha256 FROM screening_import_state').fetchone()
            if previous == (expected_sha256,):
                return None
        cursor.execute('CREATE TEMP TABLE incoming_screening_people (LIKE screening_people) ON COMMIT DROP')
        with cursor.copy('COPY incoming_screening_people FROM STDIN') as copy:
            for line_number, line in enumerate(source, 1):
                checksum.update(line)
                if not line.strip():
                    continue
                try:
                    entity = json.loads(line)
                    if entity['schema'] != 'Person':
                        continue
                    properties = entity['properties']
                    topics = properties.get('topics', [])
                    if not topics:
                        continue
                    caption = entity['caption']
                    names = list(dict.fromkeys([caption, *properties.get('name', []), *properties.get('alias', [])]))
                    normalized_names = sorted({normalized for name in names if (normalized := normalize_name(name))})
                    copy.write_row((
                        entity['id'], caption, names, normalized_names, properties.get('birthDate', []),
                        properties.get('nationality', []), properties.get('country', []), topics,
                        entity.get('datasets', []),
                    ))
                    imported += 1
                except (ValueError, KeyError, TypeError) as exc:
                    raise ValueError(f'Invalid FollowTheMoney record on line {line_number}') from exc

        if not imported:
            raise ValueError('The export contains no Person records with topics.')

        imported_sha256 = checksum.hexdigest()
        if expected_sha256 is not None and imported_sha256 != expected_sha256:
            raise ValueError('The OpenSanctions file changed during the import. Run the import again.')

        cursor.execute('ALTER TABLE incoming_screening_people ADD PRIMARY KEY (entity_id)')
        cursor.execute('LOCK TABLE screening_people IN SHARE ROW EXCLUSIVE MODE')
        cursor.execute('''
            INSERT INTO screening_people (
                entity_id, caption, names, normalized_names, birth_dates,
                nationalities, countries, topics, datasets
            )
            SELECT entity_id, caption, names, normalized_names, birth_dates,
                   nationalities, countries, topics, datasets
            FROM incoming_screening_people
            ON CONFLICT (entity_id) DO UPDATE SET
                caption = EXCLUDED.caption,
                names = EXCLUDED.names,
                normalized_names = EXCLUDED.normalized_names,
                birth_dates = EXCLUDED.birth_dates,
                nationalities = EXCLUDED.nationalities,
                countries = EXCLUDED.countries,
                topics = EXCLUDED.topics,
                datasets = EXCLUDED.datasets
            WHERE screening_people IS DISTINCT FROM EXCLUDED
        ''')
        cursor.execute('''
            DELETE FROM screening_people AS existing
            WHERE NOT EXISTS (
                SELECT 1 FROM incoming_screening_people AS incoming
                WHERE incoming.entity_id = existing.entity_id
            )
        ''')
        cursor.execute('ANALYZE screening_people')
        cursor.execute('''
            INSERT INTO screening_import_state (sha256) VALUES (%s)
            ON CONFLICT (singleton) DO UPDATE SET sha256 = EXCLUDED.sha256
        ''', (imported_sha256,))
    return imported


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', type=Path, help='Path to the export inside the API container.')
    args = parser.parse_args()
    if args.file is None:
        imported = import_people(sys.stdin.buffer)
    else:
        with args.file.open('rb') as source:
            checksum = hashlib.file_digest(source, 'sha256').hexdigest()
            source.seek(0)
            imported = import_people(source, expected_sha256=checksum)

    if imported is None:
        print('OpenSanctions export is already imported.')
    else:
        print(f'Imported {imported:,} people with OpenSanctions topics.')


if __name__ == '__main__':
    main()
