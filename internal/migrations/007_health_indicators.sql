-- +goose Up
-- +goose StatementBegin

-- Catálogo global de Indicadores (ADR 0001, ADR 0007). Não tem user_id:
-- é compartilhado por toda a instalação e ampliado só por ADMIN.
CREATE TABLE IF NOT EXISTS health_indicators (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    unit       TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extrações (ADR 0005, ADR 0006, ADR 0008). A linha nasce antes da chamada
-- ao provedor, guarda a resposta bruta e o custo em tokens.
CREATE TABLE IF NOT EXISTS extractions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id        TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    triggered_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    model          TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
    raw_response   TEXT,
    input_tokens   INTEGER,
    output_tokens  INTEGER,
    error          TEXT,
    consented_at   DATETIME NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at    DATETIME
);
CREATE INDEX IF NOT EXISTS extractions_user_id_idx ON extractions(user_id);
CREATE INDEX IF NOT EXISTS extractions_file_id_idx ON extractions(file_id);
CREATE INDEX IF NOT EXISTS extractions_status_idx  ON extractions(status);

-- Observações (ADR 0002, ADR 0003, ADR 0004, ADR 0008, ADR 0009).
-- value_text é fiel e obrigatório; value_num só quando o resultado é número
-- sem qualificador. ref_min/ref_max só quando a faixa é inequívoca.
CREATE TABLE IF NOT EXISTS health_observations (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
    indicator_id   TEXT NOT NULL REFERENCES health_indicators(id)  ON DELETE RESTRICT,
    source_file_id TEXT REFERENCES files(id)                       ON DELETE CASCADE,
    extraction_id  TEXT REFERENCES extractions(id)                 ON DELETE SET NULL,
    collected_at   DATETIME NOT NULL,
    value_text     TEXT NOT NULL,
    value_num      REAL,
    unit           TEXT,
    reference_text TEXT,
    ref_min        REAL,
    ref_max        REAL,
    out_of_range   INTEGER CHECK (out_of_range IN (0, 1)),
    provenance     TEXT NOT NULL CHECK (provenance IN ('primary', 'evolutive')),
    status         TEXT NOT NULL CHECK (status IN ('review', 'confirmed')),
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Consulta da série temporal.
CREATE INDEX IF NOT EXISTS health_observations_series_idx
    ON health_observations(user_id, indicator_id, collected_at);
CREATE INDEX IF NOT EXISTS health_observations_extraction_id_idx
    ON health_observations(extraction_id);
CREATE INDEX IF NOT EXISTS health_observations_source_file_id_idx
    ON health_observations(source_file_id);
-- Colisão primary sobre evolutive (ADR 0003) e reextração da mesma coleta.
CREATE UNIQUE INDEX IF NOT EXISTS health_observations_unique_idx
    ON health_observations(user_id, indicator_id, collected_at, provenance);

-- Metadados do documento enriquecidos pela Extração (ADR 0010).
ALTER TABLE files ADD COLUMN collected_at DATETIME;
ALTER TABLE files ADD COLUMN lab_name TEXT;
ALTER TABLE files ADD COLUMN report_number TEXT;
CREATE INDEX IF NOT EXISTS files_collected_at_idx ON files(collected_at);

-- +goose StatementEnd

-- +goose StatementBegin
-- Catálogo inicial: os 46 analitos do laudo de referência, com a unidade
-- canônica lida do próprio laudo. Indicador sem unidade é adimensional
-- (índice, razão) ou textual (morfologia).
INSERT OR IGNORE INTO health_indicators (id, code, name, unit) VALUES
    ('a1000000-0000-4000-8000-000000000001', 'erythrocytes',                 'Eritrócitos',                                  'milhões/mm3'),
    ('a1000000-0000-4000-8000-000000000002', 'hemoglobin',                   'Hemoglobina',                                  'g/dL'),
    ('a1000000-0000-4000-8000-000000000003', 'hematocrit',                   'Hematócrito',                                  '%'),
    ('a1000000-0000-4000-8000-000000000004', 'mch',                          'Hemoglobina corpuscular média',                'pg'),
    ('a1000000-0000-4000-8000-000000000005', 'mcv',                          'Volume corpuscular médio',                     'fL'),
    ('a1000000-0000-4000-8000-000000000006', 'mchc',                         'Concentração de hemoglobina corpuscular média','g/dL'),
    ('a1000000-0000-4000-8000-000000000007', 'rdw',                          'RDW',                                          '%'),
    ('a1000000-0000-4000-8000-000000000008', 'red_cell_morphology',          'Caracteres morfológicos, série vermelha',       NULL),
    ('a1000000-0000-4000-8000-000000000009', 'leukocytes',                   'Leucócitos',                                   '/mm3'),
    ('a1000000-0000-4000-8000-000000000010', 'neutrophils_abs',              'Neutrófilos, absoluto',                        '/mm3'),
    ('a1000000-0000-4000-8000-000000000011', 'neutrophils_pct',              'Neutrófilos, percentual',                      '%'),
    ('a1000000-0000-4000-8000-000000000012', 'eosinophils_abs',              'Eosinófilos, absoluto',                        '/mm3'),
    ('a1000000-0000-4000-8000-000000000013', 'eosinophils_pct',              'Eosinófilos, percentual',                      '%'),
    ('a1000000-0000-4000-8000-000000000014', 'basophils_abs',                'Basófilos, absoluto',                          '/mm3'),
    ('a1000000-0000-4000-8000-000000000015', 'basophils_pct',                'Basófilos, percentual',                        '%'),
    ('a1000000-0000-4000-8000-000000000016', 'lymphocytes_abs',              'Linfócitos, absoluto',                         '/mm3'),
    ('a1000000-0000-4000-8000-000000000017', 'lymphocytes_pct',              'Linfócitos, percentual',                       '%'),
    ('a1000000-0000-4000-8000-000000000018', 'monocytes_abs',                'Monócitos, absoluto',                          '/mm3'),
    ('a1000000-0000-4000-8000-000000000019', 'monocytes_pct',                'Monócitos, percentual',                        '%'),
    ('a1000000-0000-4000-8000-000000000020', 'white_cell_morphology',        'Caracteres morfológicos, série branca',         NULL),
    ('a1000000-0000-4000-8000-000000000021', 'platelets',                    'Plaquetas',                                    '/mm3'),
    ('a1000000-0000-4000-8000-000000000022', 'mpv',                          'Volume plaquetário médio',                     'fL'),
    ('a1000000-0000-4000-8000-000000000023', 'glucose_serum',                'Glicose, soro',                                'mg/dL'),
    ('a1000000-0000-4000-8000-000000000024', 'insulin_serum',                'Insulina, soro',                               'mU/L'),
    ('a1000000-0000-4000-8000-000000000025', 'homa_ir',                      'HOMA-IR',                                      NULL),
    ('a1000000-0000-4000-8000-000000000026', 'hba1c',                        'Hemoglobina glicada (A1C)',                    '%'),
    ('a1000000-0000-4000-8000-000000000027', 'estimated_average_glucose',    'Glicemia média estimada',                      'mg/dL'),
    ('a1000000-0000-4000-8000-000000000028', 'total_cholesterol',            'Colesterol total, soro',                       'mg/dL'),
    ('a1000000-0000-4000-8000-000000000029', 'hdl_cholesterol',              'HDL-colesterol, soro',                         'mg/dL'),
    ('a1000000-0000-4000-8000-000000000030', 'ldl_cholesterol',              'LDL-colesterol, soro',                         'mg/dL'),
    ('a1000000-0000-4000-8000-000000000031', 'non_hdl_cholesterol',          'Não-HDL-colesterol, soro',                     'mg/dL'),
    ('a1000000-0000-4000-8000-000000000032', 'vldl_cholesterol',             'VLDL-colesterol, soro',                        'mg/dL'),
    ('a1000000-0000-4000-8000-000000000033', 'triglycerides',                'Triglicérides, soro',                          'mg/dL'),
    ('a1000000-0000-4000-8000-000000000034', 'urea_serum',                   'Ureia, soro',                                  'mg/dL'),
    ('a1000000-0000-4000-8000-000000000035', 'creatinine_serum',             'Creatinina, soro',                             'mg/dL'),
    ('a1000000-0000-4000-8000-000000000036', 'egfr_ckd_epi_2009_black',      'eGFR CKD-EPI 2009, afrodescendente',           'mL/min/1,73 m2'),
    ('a1000000-0000-4000-8000-000000000037', 'egfr_ckd_epi_2009_non_black',  'eGFR CKD-EPI 2009, não afrodescendente',       'mL/min/1,73 m2'),
    ('a1000000-0000-4000-8000-000000000038', 'egfr_ckd_epi_2021',            'eGFR CKD-EPI 2021',                            'mL/min/1,73 m2'),
    ('a1000000-0000-4000-8000-000000000039', 'egfr_mdrd_black',              'eGFR MDRD, afrodescendente',                   'mL/min/1,73 m2'),
    ('a1000000-0000-4000-8000-000000000040', 'egfr_mdrd_non_black',          'eGFR MDRD, não afrodescendente',               'mL/min/1,73 m2'),
    ('a1000000-0000-4000-8000-000000000041', 'uric_acid_serum',              'Ácido úrico, soro',                            'mg/dL'),
    ('a1000000-0000-4000-8000-000000000042', 'tsh',                          'Hormônio tiroestimulante (TSH), soro',         'mUI/L'),
    ('a1000000-0000-4000-8000-000000000043', 'pth_intact',                   'Paratormônio (PTH), molécula intacta, soro',   'pg/mL'),
    ('a1000000-0000-4000-8000-000000000044', 'sodium_serum',                 'Sódio, soro',                                  'mEq/L'),
    ('a1000000-0000-4000-8000-000000000045', 'potassium_serum',              'Potássio, soro',                               'mEq/L'),
    ('a1000000-0000-4000-8000-000000000046', 'calcium_serum',                'Cálcio, soro',                                  'mg/dL'),
    ('a1000000-0000-4000-8000-000000000047', 'vitamin_d_25_hydroxy',         '25-hidroxi-vitamina D, soro',                  'ng/mL'),
    ('a1000000-0000-4000-8000-000000000048', 'vitamin_b12',                  'Vitamina B-12, soro',                          'ng/L'),
    ('a1000000-0000-4000-8000-000000000049', 'psa_total',                    'Antígeno prostático específico (PSA) total, soro', 'ng/mL'),
    ('a1000000-0000-4000-8000-000000000050', 'psa_free',                     'Antígeno prostático específico (PSA), fração livre, soro', 'ng/mL'),
    ('a1000000-0000-4000-8000-000000000051', 'psa_free_total_ratio',         'Relação PSA livre/PSA total',                   NULL),
    ('a1000000-0000-4000-8000-000000000052', 'cea',                          'Antígeno carcinoembrionário (CEA), soro',      'microgramas/L'),
    ('a1000000-0000-4000-8000-000000000053', 'ca_19_9',                      'CA 19-9, soro',                                'U/mL'),
    ('a1000000-0000-4000-8000-000000000054', 'amylase',                      'Amilase, soro',                                'U/L'),
    ('a1000000-0000-4000-8000-000000000055', 'lipase',                       'Lipase, soro',                                 'U/L');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS files_collected_at_idx;
ALTER TABLE files DROP COLUMN report_number;
ALTER TABLE files DROP COLUMN lab_name;
ALTER TABLE files DROP COLUMN collected_at;
DROP TABLE IF EXISTS health_observations;
DROP TABLE IF EXISTS extractions;
DROP TABLE IF EXISTS health_indicators;
-- +goose StatementEnd
