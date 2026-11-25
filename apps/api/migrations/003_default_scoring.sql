-- FloppyDisk: initial weight version and scoring reference values.

-- Support databases that used the previous order of the development seeds.
ALTER TABLE weights ALTER COLUMN created_by_officer_id DROP NOT NULL;

CREATE TEMPORARY TABLE default_country_risks (
    country_code TEXT PRIMARY KEY,
    risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score BETWEEN 0 AND 5)
) ON COMMIT DROP;

INSERT INTO default_country_risks (country_code, risk_score) VALUES
    ('DK', 0.55), -- Denmark
    ('FI', 0.60), -- Finland
    ('SG', 0.80), -- Singapore
    ('NZ', 0.95), -- New Zealand
    ('NO', 0.95), -- Norway
    ('SE', 1.00), -- Sweden
    ('CH', 1.00), -- Switzerland
    ('LU', 1.10), -- Luxembourg
    ('NL', 1.10), -- Netherlands
    ('DE', 1.15), -- Germany
    ('IS', 1.15), -- Iceland
    ('AU', 1.20), -- Australia
    ('EE', 1.20), -- Estonia
    ('HK', 1.20), -- Hong Kong
    ('IE', 1.20), -- Ireland
    ('CA', 1.25), -- Canada
    ('UY', 1.35), -- Uruguay
    ('BT', 1.45), -- Bhutan
    ('JP', 1.45), -- Japan
    ('GB', 1.50), -- United Kingdom
    ('AT', 1.55), -- Austria
    ('BE', 1.55), -- Belgium
    ('AE', 1.55), -- United Arab Emirates
    ('BB', 1.60), -- Barbados
    ('SC', 1.60), -- Seychelles
    ('TW', 1.60), -- Taiwan
    ('FR', 1.70), -- France
    ('LT', 1.75), -- Lithuania
    ('BS', 1.80), -- Bahamas
    ('US', 1.80), -- United States of America
    ('BN', 1.85), -- Brunei Darussalam
    ('CL', 1.85), -- Chile
    ('KR', 1.85), -- Korea, South
    ('VC', 1.85), -- Saint Vincent and the Grenadines
    ('CV', 1.90), -- Cabo Verde
    ('IL', 1.90), -- Israel
    ('DM', 2.00), -- Dominica
    ('LV', 2.00), -- Latvia
    ('CZ', 2.05), -- Czechia
    ('LC', 2.05), -- Saint Lucia
    ('BW', 2.10), -- Botswana
    ('QA', 2.10), -- Qatar
    ('RW', 2.10), -- Rwanda
    ('SI', 2.10), -- Slovenia
    ('SA', 2.15), -- Saudi Arabia
    ('CR', 2.20), -- Costa Rica
    ('GD', 2.20), -- Grenada
    ('PT', 2.20), -- Portugal
    ('CY', 2.25), -- Cyprus
    ('FJ', 2.25), -- Fiji
    ('ES', 2.25), -- Spain
    ('IT', 2.35), -- Italy
    ('PL', 2.35), -- Poland
    ('MY', 2.40), -- Malaysia
    ('OM', 2.40), -- Oman
    ('BH', 2.50), -- Bahrain
    ('GE', 2.50), -- Georgia
    ('GR', 2.50), -- Greece
    ('JO', 2.50), -- Jordan
    ('MT', 2.55), -- Malta
    ('MU', 2.60), -- Mauritius
    ('SK', 2.60), -- Slovakia
    ('HR', 2.65), -- Croatia
    ('VU', 2.65), -- Vanuatu
    ('AM', 2.70), -- Armenia
    ('KW', 2.70), -- Kuwait
    ('ME', 2.70), -- Montenegro
    ('NA', 2.70), -- Namibia
    ('SN', 2.70), -- Senegal
    ('BJ', 2.75), -- Benin
    ('RO', 2.75), -- Romania
    ('ST', 2.75), -- Sao Tome and Principe
    ('JM', 2.80), -- Jamaica
    ('SB', 2.80), -- Solomon Islands
    ('TL', 2.80), -- Timor-Leste
    ('CN', 2.85), -- China
    ('CI', 2.85), -- Cote d'Ivoire
    ('GH', 2.85), -- Ghana
    ('XK', 2.85), -- Kosovo
    ('MD', 2.90), -- Moldova
    ('ZA', 2.95), -- South Africa
    ('TT', 2.95), -- Trinidad and Tobago
    ('VN', 2.95), -- Vietnam
    ('BG', 3.00), -- Bulgaria
    ('BF', 3.00), -- Burkina Faso
    ('CU', 3.00), -- Cuba
    ('GY', 3.00), -- Guyana
    ('HU', 3.00), -- Hungary
    ('MK', 3.00), -- North Macedonia
    ('TZ', 3.00), -- Tanzania
    ('AL', 3.05), -- Albania
    ('IN', 3.05), -- India
    ('MV', 3.05), -- Maldives
    ('MA', 3.05), -- Morocco
    ('TN', 3.05), -- Tunisia
    ('ET', 3.10), -- Ethiopia
    ('KZ', 3.10), -- Kazakhstan
    ('SR', 3.10), -- Suriname
    ('CO', 3.15), -- Colombia
    ('DO', 3.15), -- Dominican Republic
    ('GM', 3.15), -- Gambia
    ('LS', 3.15), -- Lesotho
    ('ZM', 3.15), -- Zambia
    ('AR', 3.20), -- Argentina
    ('BZ', 3.20), -- Belize
    ('UA', 3.20), -- Ukraine
    ('BR', 3.25), -- Brazil
    ('LK', 3.25), -- Sri Lanka
    ('DZ', 3.30), -- Algeria
    ('BA', 3.30), -- Bosnia and Herzegovina
    ('ID', 3.30), -- Indonesia
    ('LA', 3.30), -- Laos
    ('MW', 3.30), -- Malawi
    ('NP', 3.30), -- Nepal
    ('SL', 3.30), -- Sierra Leone
    ('EC', 3.35), -- Ecuador
    ('PA', 3.35), -- Panama
    ('RS', 3.35), -- Serbia
    ('TH', 3.35), -- Thailand
    ('AO', 3.40), -- Angola
    ('SV', 3.40), -- El Salvador
    ('PH', 3.40), -- Philippines
    ('TG', 3.40), -- Togo
    ('BY', 3.45), -- Belarus
    ('DJ', 3.45), -- Djibouti
    ('MN', 3.45), -- Mongolia
    ('NE', 3.45), -- Niger
    ('TR', 3.45), -- Turkey
    ('UZ', 3.45), -- Uzbekistan
    ('AZ', 3.50), -- Azerbaijan
    ('EG', 3.50), -- Egypt
    ('KE', 3.50), -- Kenya
    ('MR', 3.50), -- Mauritania
    ('PE', 3.50), -- Peru
    ('GA', 3.55), -- Gabon
    ('BO', 3.60), -- Bolivia
    ('IQ', 3.60), -- Iraq
    ('LR', 3.60), -- Liberia
    ('ML', 3.60), -- Mali
    ('PK', 3.60), -- Pakistan
    ('MX', 3.65), -- Mexico
    ('CM', 3.70), -- Cameroon
    ('GT', 3.70), -- Guatemala
    ('GN', 3.70), -- Guinea
    ('KG', 3.70), -- Kyrgyzstan
    ('NG', 3.70), -- Nigeria
    ('PG', 3.70), -- Papua New Guinea
    ('MG', 3.75), -- Madagascar
    ('UG', 3.75), -- Uganda
    ('BD', 3.80), -- Bangladesh
    ('CF', 3.80), -- Central African Republic
    ('PY', 3.80), -- Paraguay
    ('CG', 3.85), -- Congo
    ('SZ', 3.85), -- Eswatini
    ('IR', 3.85), -- Iran
    ('LB', 3.85), -- Lebanon
    ('TD', 3.90), -- Chad
    ('HN', 3.90), -- Honduras
    ('RU', 3.90), -- Russia
    ('ZW', 3.90), -- Zimbabwe
    ('GW', 3.95), -- Guinea Bissau
    ('MZ', 3.95), -- Mozambique
    ('KH', 4.00), -- Cambodia
    ('KM', 4.00), -- Comoros
    ('CD', 4.00), -- Democratic Republic of the Congo
    ('TJ', 4.05), -- Tajikistan
    ('BI', 4.15), -- Burundi
    ('TM', 4.15), -- Turkmenistan
    ('AF', 4.20), -- Afghanistan
    ('HT', 4.20), -- Haiti
    ('MM', 4.20), -- Myanmar
    ('GQ', 4.25), -- Equatorial Guinea
    ('KP', 4.25), -- Korea, North
    ('SY', 4.25), -- Syria
    ('NI', 4.30), -- Nicaragua
    ('SD', 4.30), -- Sudan
    ('ER', 4.35), -- Eritrea
    ('LY', 4.35), -- Libya
    ('YE', 4.35), -- Yemen
    ('VE', 4.50), -- Venezuela
    ('SO', 4.55), -- Somalia
    ('SS', 4.55) -- South Sudan
;

DO $$
DECLARE
    default_version INTEGER;
BEGIN
    -- Preserve the configuration and its owners when updating an existing database.
    IF EXISTS (SELECT 1 FROM weights) THEN
        RETURN;
    END IF;

    INSERT INTO weights (
        country_of_residence_weight,
        nationality_weight,
        tax_domicile_weight,
        professional_activity_weight,
        income_weight
    )
    VALUES (1.5, 0.5, 1.0, 1.25, 0.75)
    RETURNING version_number INTO default_version;

    INSERT INTO country_of_residence_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks JOIN countries USING (country_code);

    INSERT INTO nationality_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks JOIN countries USING (country_code);

    INSERT INTO tax_domicile_risk (weights_version, country_code, risk_score)
    SELECT default_version, country_code, risk_score
    FROM default_country_risks JOIN countries USING (country_code);

    INSERT INTO income_risk (weights_version, income_range_id, risk_score)
    SELECT
        default_version,
        id,
        CASE label
            WHEN '0-10k' THEN 2
            WHEN '10k-50k' THEN 1
            WHEN '50k-100k' THEN 1.5
            WHEN '100k+' THEN 3
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
            WHEN 'Standard' THEN 1
            WHEN 'Cash-intensive' THEN 3.5
            WHEN 'High-risk' THEN 5
        END
    FROM professional_categories
    WHERE name IN ('Standard', 'Cash-intensive', 'High-risk');
END;
$$;
