-- Apply after 001 and 002. Existing country records are preserved.
BEGIN;

INSERT INTO officers (internal_id, name, work_email) VALUES
    ('0000000000', 'Alice Smith', 'alice.smith@example.com')
ON CONFLICT DO NOTHING;

COMMIT;
