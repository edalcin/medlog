-- +goose Up
-- +goose StatementBegin

-- Sexo biológico e data de nascimento do usuário (ADR 0014). É fisiologia
-- que condiciona a faixa de normalidade, não identidade de gênero. Ambas
-- nascem nulas: nenhuma conta existente tem esse dado, e o SQLite não
-- permite CHECK em coluna adicionada por ALTER TABLE — a validação de
-- 'M'/'F' e de data plausível fica em Go (handler MeUpdate).
ALTER TABLE users ADD COLUMN biological_sex TEXT;
ALTER TABLE users ADD COLUMN birth_date DATE;

-- Faixa de normalidade em tabela própria, independente do indicador global
-- (ADR 0015). sex/age_min/age_max nulos = "qualquer"; min/max nulos = "sem
-- banda para desenhar no gráfico", mas ainda assim uma faixa com texto.
-- source é obrigatório: toda faixa cita de onde veio.
-- Esta migração cria a tabela vazia; o seed das 55 faixas do laudo de
-- referência entra na 009, depois de revisão humana do dado clínico.
CREATE TABLE IF NOT EXISTS indicator_normal_ranges (
    id           TEXT PRIMARY KEY,
    indicator_id TEXT NOT NULL REFERENCES health_indicators(id) ON DELETE CASCADE,
    sex          TEXT CHECK (sex IN ('M', 'F')),
    age_min      INTEGER,
    age_max      INTEGER,
    min          REAL,
    max          REAL,
    text         TEXT NOT NULL,
    source       TEXT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS indicator_normal_ranges_indicator_id_idx
    ON indicator_normal_ranges(indicator_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS indicator_normal_ranges;
ALTER TABLE users DROP COLUMN birth_date;
ALTER TABLE users DROP COLUMN biological_sex;
-- +goose StatementEnd
