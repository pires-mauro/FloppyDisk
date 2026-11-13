BEGIN;

ALTER TABLE officers
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE officers
SET password_hash = 'scrypt$16384$8$1$tKxm-KrpASDJIARiMaQ0RA$yXAJYuhuf69__tjpj2Ldc_Nwnz8H-hed0_AvOAx9GTo'
WHERE internal_id = '0000000000';

UPDATE officers
SET password_hash = 'scrypt$16384$8$1$QWhOLcb7kaQ_oa3eA1epIQ$e5aE2KzF8cWJLWhgwYTSG_pe1zWtcSlHEQlJe6bktFY'
WHERE internal_id = '0000000001';

COMMIT;
