CREATE TABLE screening_import_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
