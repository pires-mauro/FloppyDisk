BEGIN;

CREATE TEMPORARY TABLE default_country_risks ON COMMIT DROP AS
SELECT
    country_code,
    CASE country_code
        WHEN 'LU' THEN 1
        WHEN 'FR' THEN 5
        ELSE ((row_number() OVER (
            ORDER BY md5(country_code || ':default-country-risk')
        ) - 1) % 5 + 1)::INTEGER
    END AS risk_score
FROM countries;

DO $$
DECLARE
    default_version INTEGER;
    admin_officer_id INTEGER;
BEGIN
    SELECT id INTO admin_officer_id
    FROM officers
    WHERE internal_id = '0000000000';

    IF admin_officer_id IS NULL THEN
        RAISE EXCEPTION 'Default admin officer is missing';
    END IF;

    INSERT INTO weights (
        country_of_residence_weight,
        nationality_weight,
        tax_domicile_weight,
        professional_activity_weight,
        income_weight,
        created_by_officer_id
    )
    VALUES (3, 3, 3, 3, 3, admin_officer_id)
    RETURNING version_number INTO default_version;

    INSERT INTO country_of_residence_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks;

    INSERT INTO nationality_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks;

    INSERT INTO tax_domicile_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks;

    INSERT INTO income_risk (weights_version, income_range_id, risk_score)
    SELECT
        default_version,
        id,
        CASE label
            WHEN '0-10k' THEN 4
            WHEN '10k-50k' THEN 3
            WHEN '50k-100k' THEN 2
            WHEN '100k+' THEN 1
        END
    FROM income_ranges
    WHERE label IN ('0-10k', '10k-50k', '50k-100k', '100k+');

    INSERT INTO professional_activity_risk (
        weights_version,
        professional_category_id,
        risk_score
    )
    SELECT
        default_version,
        id,
        CASE name
            WHEN 'Standard' THEN 2
            WHEN 'Cash-intensive' THEN 3
            WHEN 'High-risk' THEN 5
        END
    FROM professional_categories
    WHERE name IN ('Standard', 'Cash-intensive', 'High-risk');
END;
$$;

COMMIT;
