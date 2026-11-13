BEGIN;

ALTER TABLE officers
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO officers (internal_id, name, work_email, is_admin)
VALUES ('0000000000', 'Alice Smith', 'alice.smith@example.com', TRUE)
ON CONFLICT (internal_id) DO UPDATE
SET is_admin = TRUE;

INSERT INTO officers (internal_id, name, work_email, is_admin)
VALUES ('0000000001', 'Bob Jones', 'bob.jones@example.com', FALSE)
ON CONFLICT (internal_id) DO UPDATE
SET is_admin = FALSE;

COMMIT;
