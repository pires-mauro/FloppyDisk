-- FloppyDisk: initial PostgreSQL 17 schema.
-- Apply ONCE to an empty application database with psql ON_ERROR_STOP=1.
-- Run 002_reference_data.sql afterwards. No existing objects are dropped.
BEGIN;

CREATE TYPE marital_status_enum AS ENUM (
    'single', 'married', 'divorced', 'widowed', 'separated'
);

CREATE TYPE assessment_decision_enum AS ENUM (
    'pending',
    'approved',
    'manual_review',
    'rejected'
);

CREATE TYPE risk_tier_enum AS ENUM (
    'low',
    'medium',
    'high'
);

-- CLIENT INFORMATION AND LOOKUP VALUES
-- Country codes match the two-letter values supplied by the frontend.
CREATE TABLE countries (
    country_code TEXT PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
    name TEXT NOT NULL CHECK (btrim(name) <> '')
);

CREATE TABLE addresses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    street TEXT NOT NULL,
    house_number TEXT,
    postal_code TEXT,
    city TEXT NOT NULL,
    country_code TEXT NOT NULL REFERENCES countries(country_code),
    UNIQUE (id, country_code)
);

-- Bounds are inclusive at the bottom and exclusive at the top.
-- A NULL upper bound means there is no upper limit. One agreed currency.
CREATE TABLE income_ranges (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,
    lower_bound NUMERIC(15, 2) NOT NULL CHECK (lower_bound >= 0),
    upper_bound NUMERIC(15, 2),
    CHECK (upper_bound IS NULL OR upper_bound > lower_bound),
    EXCLUDE USING gist (numrange(lower_bound, upper_bound, '[)') WITH &&)
);

-- These are the frontend's categories, not individual occupations.
CREATE TABLE professional_categories (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE officers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    internal_id TEXT NOT NULL UNIQUE CHECK (internal_id ~ '^[0-9]{10}$'),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    work_email TEXT NOT NULL CHECK (btrim(work_email) <> '')
);

CREATE UNIQUE INDEX officers_work_email_unique
    ON officers (lower(work_email));

CREATE TABLE clients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (btrim(name) <> ''),
    id_number VARCHAR(100) NOT NULL CHECK (btrim(id_number) <> ''),
    id_issuing_country_code TEXT NOT NULL REFERENCES countries(country_code),
    date_of_birth DATE NOT NULL,
    nationality_country_code TEXT NOT NULL REFERENCES countries(country_code),
    tax_domicile_country_code TEXT NOT NULL REFERENCES countries(country_code),
    address_id INTEGER NOT NULL REFERENCES addresses(id),
    income_range_id INTEGER NOT NULL REFERENCES income_ranges(id),
    professional_category_id INTEGER NOT NULL REFERENCES professional_categories(id),
    marital_status marital_status_enum NOT NULL,
    email TEXT NOT NULL CHECK (btrim(email) <> ''),
    dial_prefix TEXT NOT NULL CHECK (dial_prefix ~ '^\+[1-9][0-9]{0,2}$'),
    phone_number TEXT NOT NULL CHECK (phone_number ~ '^[0-9]+$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_number, id_issuing_country_code)
);

-- RISK CONFIGURATION: distinct from client information and evaluated scores.
-- A weights version identifies the full scoring configuration: weights AND
-- the country/income/profession rules below. Create a new version when either changes.
-- Weights are nonnegative relative weights; the calculator must normalize them.
CREATE TABLE weights (
    version_number INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_of_residence_weight INTEGER NOT NULL CHECK (country_of_residence_weight >= 0),
    nationality_weight INTEGER NOT NULL CHECK (nationality_weight >= 0),
    tax_domicile_weight INTEGER NOT NULL CHECK (tax_domicile_weight >= 0),
    professional_activity_weight INTEGER NOT NULL
        CHECK (professional_activity_weight >= 0),
    income_weight INTEGER NOT NULL CHECK (income_weight >= 0),
    created_by_officer_id INTEGER NOT NULL REFERENCES officers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (country_of_residence_weight + nationality_weight +
           tax_domicile_weight + professional_activity_weight + income_weight > 0)
);

CREATE TABLE country_risk (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    weights_version INTEGER NOT NULL REFERENCES weights(version_number),
    country_code TEXT NOT NULL REFERENCES countries(country_code),
    risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    UNIQUE (weights_version, country_code)
);

CREATE TABLE income_risk (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    weights_version INTEGER NOT NULL REFERENCES weights(version_number),
    income_range_id INTEGER NOT NULL REFERENCES income_ranges(id),
    risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    UNIQUE (weights_version, income_range_id)
);

CREATE TABLE professional_activity_risk (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    weights_version INTEGER NOT NULL REFERENCES weights(version_number),
    professional_category_id INTEGER NOT NULL REFERENCES professional_categories(id),
    risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    UNIQUE (weights_version, professional_category_id)
);

-- SANCTIONS REFERENCE INFORMATION
CREATE TABLE sanctions_roles (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role TEXT NOT NULL UNIQUE CHECK (btrim(role) <> ''),
    red_flag BOOLEAN NOT NULL
);


CREATE TABLE risk_assessments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    officer_id INTEGER NOT NULL REFERENCES officers(id),
    final_score NUMERIC(3, 2) CHECK (final_score BETWEEN 1 AND 5),
    assigned_tier risk_tier_enum NOT NULL,
    officer_comment VARCHAR(500),
    decision assessment_decision_enum NOT NULL DEFAULT 'pending',
    preliminary BOOLEAN NOT NULL DEFAULT TRUE,
    evaluation_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    weights_version INTEGER NOT NULL REFERENCES weights(version_number),
    sanctions_role_id INTEGER REFERENCES sanctions_roles(id),

    -- Not sure about this one. Do we support changing a clients data after they have been added?
    input_snapshot JSONB NOT NULL
        CHECK (jsonb_typeof(input_snapshot) = 'object' AND input_snapshot <> '{}'::jsonb),
    CHECK (preliminary OR final_score IS NOT NULL),
    CHECK (decision = 'pending' OR (NOT preliminary AND final_score IS NOT NULL))
);

CREATE INDEX risk_assessments_client_time_idx
    ON risk_assessments(client_id, evaluation_time DESC);
CREATE INDEX risk_assessments_weights_version_idx
    ON risk_assessments(weights_version);

-- Store actual evaluated scores, not only links to changeable lookup values.
-- A shared primary key enforces at most one factor record per assessment.
CREATE TABLE evaluated_risk_factors (
    risk_assessment_id INTEGER PRIMARY KEY REFERENCES risk_assessments(id),
    country_of_residence_risk NUMERIC(5, 2) NOT NULL
        CHECK (country_of_residence_risk BETWEEN 0 AND 100),
    nationality_risk NUMERIC(5, 2) NOT NULL CHECK (nationality_risk BETWEEN 0 AND 100),
    tax_domicile_risk NUMERIC(5, 2) NOT NULL CHECK (tax_domicile_risk BETWEEN 0 AND 100),
    professional_activity_risk NUMERIC(5, 2) NOT NULL
        CHECK (professional_activity_risk BETWEEN 0 AND 100),
    income_risk NUMERIC(5, 2) NOT NULL CHECK (income_risk BETWEEN 0 AND 100)
);

COMMIT;