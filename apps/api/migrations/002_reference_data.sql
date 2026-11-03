BEGIN;

INSERT INTO income_ranges (label, lower_bound, upper_bound)
VALUES
    ('0-10k',       0,      10000),
    ('10k-50k',     10000,  50000),
    ('50k-100k',    50000,  100000),
    ('100k+',       100000, NULL);

INSERT INTO professional_categories (name)
VALUES
    ('Standard'),
    ('Cash-intensive'),
    ('High-risk');

COMMIT;