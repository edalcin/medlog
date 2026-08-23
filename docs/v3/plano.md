# Plano faseado — MedLog V3.0

Extração de indicadores de saúde de PDFs de laudo por meio do Gemini, com revisão humana antes de o dado valer, e visualização em série temporal.

Origem do requisito: `docs/v3/MedLog V3.0.md`. Decisões e fatos levantados: `docs/proximosPassos.md`. Decisões difíceis de reverter: `docs/adr/0001` a `0010`. Vocabulário: `CONTEXT.md`.

A ordem das fases é dependência real, não preferência. A fase 2 precisa do catálogo da fase 1, a 3 precisa de dado produzido pela 2, e a 4 precisa de dado confirmado pela 3.

---

## Fase 1 — Esquema

Migração `007` (a próxima livre; existem `001` a `006`), SQL embutido por `go:embed` em `internal/migrations/`, com `Up` e `Down`.

**`health_indicators`** — catálogo global, não por usuário.
`id` TEXT PK (UUID), `code` TEXT UNIQUE, `name` TEXT, `unit` TEXT, `created_at` DATETIME.
Semeado na própria migração com os cerca de 40 analitos do laudo de referência, hemograma incluído, cada sub-analito com seu próprio `code`.

**`health_observations`**
`id` TEXT PK, `user_id` TEXT REFERENCES `users` ON DELETE CASCADE, `indicator_id` TEXT REFERENCES `health_indicators`, `source_file_id` TEXT REFERENCES `files`, `extraction_id` TEXT REFERENCES `extractions`, `collected_at` DATETIME, `value_text` TEXT NOT NULL, `value_num` REAL NULL, `unit` TEXT, `reference_text` TEXT, `ref_min` REAL NULL, `ref_max` REAL NULL, `out_of_range` INTEGER NULL, `provenance` TEXT CHECK (`primary`, `evolutive`), `status` TEXT CHECK (`review`, `confirmed`), `created_at` DATETIME.
Índice por `(user_id, indicator_id, collected_at)`, que é a consulta da série temporal.

**`extractions`**
`id` TEXT PK, `user_id`, `file_id`, `triggered_by` TEXT REFERENCES `users`, `model` TEXT, `prompt_version` TEXT, `schema_version` TEXT, `status` TEXT CHECK (`pending`, `succeeded`, `failed`), `raw_response` TEXT NULL, `input_tokens` INTEGER NULL, `output_tokens` INTEGER NULL, `error` TEXT NULL, `consented_at` DATETIME, `created_at`, `finished_at` NULL.

**`files`** — colunas novas: `collected_at` DATETIME NULL, `lab_name` TEXT NULL, `report_number` TEXT NULL.

**Prova:** `goose up` e `goose down` completam; o catálogo retorna os cerca de 40 códigos semeados.

---

## Fase 2 — Extração

Sem interface. É a fase que concentra o risco do projeto: primeira dependência de rede externa, formato de saída do modelo, e qualidade do mapeamento para o catálogo.

- Cliente Gemini em Go puro, sem dependência com C, respeitando `CGO_ENABLED=0`. `GEMINI_API_KEY` de variável de ambiente; modelo lido de `app_config.gemini_model`, com padrão `gemini-3.1-flash-lite`.
- Esquema de saída declarado em Go e enviado como `responseSchema`. Lista plana de Observações, `value_text` sempre, `value_num` opcional.
- Prompt versionado, recebendo a lista fechada de `code` do catálogo. Analito sem correspondência não cria Indicador: vira pendência.
- Endpoint `ADMIN` de disparo: exige Consentimento explícito para aquele documento, grava a linha em `extractions` como `pending`, e retorna imediatamente.
- Goroutine executa a chamada **fora de qualquer transação**, grava `raw_response` e os contadores de token, e só então interpreta em Observações, que nascem com `status = review`. Metadados sugeridos para `files` acompanham, sem serem gravados ainda.
- Endpoint `ADMIN` de status, para o frontend consultar por polling.

**Prova:** extrair o PDF de referência de verdade, com chave real, e conferir no banco as Observações `primary` e `evolutive`, a resposta bruta e o custo em tokens. Iterar no prompt até o mapeamento fechar, antes de existir tela.

---

## Fase 3 — Revisão

- Tela de revisão em bloco: a lista completa de Observações da Extração ao lado do PDF, com valor, unidade, faixa de referência, marcador de alteração e procedência visíveis.
- Divergências destacadas: analito não catalogado, unidade diferente da canônica, e metadado de `files` que já tem valor humano diferente do sugerido.
- Confirmar em bloco muda `status` para `confirmed` e grava os metadados de `files` aceitos. Rejeitar em bloco descarta as Observações e preserva a Extração, que continua auditável.
- Promover um `code` novo ao catálogo é ação de `ADMIN` a partir da própria pendência.
- Aba admin: seleção do modelo a partir de lista curta declarada em Go, com o custo estimado por Extração ao lado de cada opção.

**Prova:** confirmar o laudo de referência pela interface e ver as Observações passarem a valer.

---

## Fase 4 — Visualização

- Série temporal por Indicador, ordenada por Data de coleta, apenas com Observações `confirmed`.
- Faixa de referência desenhada onde `ref_min` e `ref_max` existem; ausente onde o laudo é condicional.
- Ponto de procedência `evolutive` visualmente distinto, porque não traz método nem faixa própria.
- Observação sem `value_num` aparece em lista, não em gráfico.
- Nenhuma biblioteca de gráficos existe hoje no frontend; escolher a menor que resolva, dado o compromisso com o tamanho da imagem Docker.

**Prova:** gráfico do PDF de referência cobrindo de 2018 a 2026, alimentado pelo laudo evolutivo mais a coleta corrente.

---

## Fora de escopo

Relatórios de saúde gerados por IA ficam para a v3.1, com grill próprio, incluindo a fronteira de não produzir texto que se leia como diagnóstico médico (Q7).

Cota de gasto por usuário, extração por `USER` não administrador, LOINC como chave, e fila com worker dedicado: todos rejeitados nesta versão, com o motivo registrado nos ADRs correspondentes.
