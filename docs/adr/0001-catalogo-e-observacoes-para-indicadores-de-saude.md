---
status: accepted
---

# Catálogo e Observações em vez de tabela por tipo de exame

A versão 3.0 passa a armazenar indicadores de saúde extraídos de laudos, e o requisito é que a base aceite indicadores além dos de exame de sangue (peso, pressão arterial, sono). Decidimos modelar dois conceitos separados: `health_indicators`, o catálogo do que pode ser medido, e `health_observations`, cada medição concreta. Assim um indicador novo é uma linha no catálogo, não uma migração de esquema.

## Considered Options

Uma tabela por tipo de exame, com uma coluna por analito (`exame_sangue.glicose`, `exame_sangue.creatinina`, ...), foi rejeitada: o hemograma sozinho traz cerca de 20 analitos, o laudo de referência traz cerca de 40 no total, vários deles calculados (HOMA-IR, eGFR em três equações, VLDL por fórmula de Martin/Hopkins), e cada indicador novo — laboratorial ou não — custaria uma migração. O modelo por colunas é mais direto de consultar, mas contraria diretamente o requisito de extensibilidade.

## Consequences

Ver "o exame de sangue de maio" exige agrupar linhas em vez de ler uma. Em troca, a consulta que mais importa — a série temporal de um indicador ao longo dos anos — fica trivial.
