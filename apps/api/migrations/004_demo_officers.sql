-- Local demo officers
INSERT INTO officers (internal_id, name, work_email, is_admin, password_hash)
VALUES
    ('0000000000', 'Alice Smith', 'alice.smith@example.com', TRUE, 'scrypt$16384$8$1$tKxm-KrpASDJIARiMaQ0RA$yXAJYuhuf69__tjpj2Ldc_Nwnz8H-hed0_AvOAx9GTo'),
    ('0000000001', 'Bob Jones', 'bob.jones@example.com', FALSE, 'scrypt$16384$8$1$QWhOLcb7kaQ_oa3eA1epIQ$e5aE2KzF8cWJLWhgwYTSG_pe1zWtcSlHEQlJe6bktFY')
ON CONFLICT (internal_id) DO NOTHING;
