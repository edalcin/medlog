# Próximos Passos — MedLog V3.0

Documento de continuidade entre sessões. Registra o que já foi decidido, o que está em aberto e os fatos do repositório levantados, para que uma sessão nova retome sem reinvestigar.

**Última atualização:** 2026-08-22
**Fase atual:** entrevista de desenho (grill) em andamento. Nenhuma linha de código alterada, por decisão explícita do usuário.

---

## 1. Objetivo da versão 3.0

Extrair dados de PDFs de exames já registrados no MedLog, por meio de um agente de IA (Gemini), para alimentar tabelas de indicadores de saúde no SQLite existente. O usuário seleciona um PDF por vez. A chave da API entra como variável de ambiente `GEMINI_API_KEY` no Docker, e o modelo é selecionável pela interface administrativa. As tabelas devem aceitar indicadores além dos de exame de sangue, e servir de fonte para relatórios de saúde gerados por IA no futuro.

Documento de origem: `docs/v3/MedLog V3.0.md`.

---

## 2. Decisões fechadas

| # | Decisão | Registro |
|---|---|---|
| Q1 | Catálogo + Observações (`health_indicators` + `health_observations`), em vez de uma tabela por tipo de exame | `docs/adr/0001-catalogo-e-observacoes-para-indicadores-de-saude.md` |
| Q2 | Sem entidade `Coleta`. A Observação carrega `collected_at` e `source_file_id`; o Laudo agrupa | `docs/adr/0002-sem-entidade-coleta-o-laudo-agrupa-observacoes.md` |
| Q3 | Ingerir também o laudo evolutivo, distinguindo `provenance` (`primary` prevalece sobre `evolutive`) | `docs/adr/0003-ingestao-do-laudo-evolutivo-com-procedencia.md` |

Glossário do domínio em `CONTEXT.md`: Indicador, Observação, Laudo, Data de coleta, Procedência, Laudo evolutivo.

---

## 3. Perguntas em aberto

Aguardando decisão do usuário. Uma pergunta por vez, na ordem abaixo.

### Q4 — Valores de referência (em aberto agora)

As faixas do laudo são condicionais, e cada exame condiciona por um eixo diferente: TSH por idade, ácido úrico por sexo, triglicérides por jejum, LDL por categoria de risco cardiovascular, eGFR por etnia e equação, hemograma por sexo e idade.

- (a) Só o texto do laudo, fiel
- (b) Só `ref_min`/`ref_max` numéricos
- (c) Texto fiel + `ref_min`/`ref_max` opcionais (só quando inequívocos) + `out_of_range` vindo do marcador `(1)` do próprio laboratório

**Recomendação: (c).** O laboratório já conhece sexo, idade e condições de coleta, e já declara o que está fora da faixa. Recalcular produziria resposta pior com menos informação.

### Q5 — Privacidade da PII e autorização de gasto

Enviar o PDF ao Gemini expõe ao Google nome completo, data de nascimento, médico e laboratório. Três decisões na mesma fronteira de confiança: redigir a PII antes de enviar; exigir consentimento explícito por documento; e quem pode disparar a extração, dado que `GEMINI_API_KEY` é credencial global e cada extração custa dinheiro, num modelo de compartilhamento familiar.

**Recomendação:** não redigir (quebraria a validação de identidade e a interpretação por idade); consentimento explícito por documento, com registro de quem disparou, quando, qual modelo e custo em tokens; extração restrita a `ADMIN` na primeira fase. Merece ADR.

### Q6 — Execução: síncrona ou trabalho persistido

Dois fatos conflitam com o caminho óbvio: `frontend/src/lib/api.ts` aborta todo `fetch` em 30s, e o SQLite roda com uma única conexão física, então segurar transação durante a chamada externa travaria o app.

- (a) Inline síncrono com timeout maior
- (b) Linha em `extractions` gravada antes da chamada, execução em goroutine, frontend consultando status
- (c) Fila com worker

**Recomendação: (b).** Tokens são caros e limitados; gravar a resposta bruta antes de interpretar evita pagar a extração de novo por erro de parsing. A chamada externa acontece fora de qualquer transação.

### Q7 — Relatórios de IA dentro ou fora da v3.0

**Recomendação:** fora. Fases 1 a 4 entregam extração, revisão e visualização; relatórios ficam para v3.1, com grill próprio.

### Rodada seguinte (depende das acima)

Catálogo inicial de indicadores e chave de deduplicação; contrato de saída da IA e versionamento de prompt; tela de revisão humana; seleção do modelo na interface admin; corte exato das fases.

---

## 4. Fatos do repositório (levantados, não presumir de novo)

**Stack e restrições**
- Go 1.24, `chi` v5, `modernc.org/sqlite` v1.37.1 puro Go, `CGO_ENABLED=0`. Imagem final `alpine:3.21`, ~30MB. Qualquer dependência com C está fora.
- Gemini seria a **primeira dependência de rede externa** do projeto.
- Migrações: `goose` v3, SQL embutido via `go:embed` em `internal/migrations/`. Existem `001`–`006`; **a próxima é `007`**.
- `internal/db/db.go`: uma única conexão física (`MaxOpenConns=1`), WAL, `foreign_keys=ON`, `busy_timeout=5000`.
- PKs são UUID TEXT (`google/uuid`). Timestamps `DATETIME` no formato `YYYY-MM-DD HH:MM:SS`.
- Sem extensão JSON em uso.
- `frontend/src/lib/api.ts`: wrapper `fetch` com `credentials: 'include'` e **timeout de 30s**.
- Frontend Svelte 5 compilado pelo Vite e embutido no binário via `go:embed` (`internal/embed/dist`).

**Multiusuário e autenticação**
- `users.role` com `ADMIN` | `USER`. Middlewares `RequireAuth` e `RequireAdmin` em `internal/auth/middleware.go`.
- Todas as tabelas de domínio têm `user_id` com `ON DELETE CASCADE`. Há compartilhamento familiar.
- Sessões via `alexedwards/scs` com store SQLite.
- `app_config(key TEXT PK, value TEXT)` **já existe** (migração 003, hoje só guarda `session_secret_hash`) — cabe o modelo Gemini escolhido, sem tabela nova.

**Documentos**
- Tabela `files`: `id`, `filename`, `custom_name`, `path`, `mime_type`, `size`, `hash` (SHA256), `thumbnail_path` (coluna existe e nunca é preenchida), `consultation_id`, `professional_id`, `user_id`, `uploaded_at`.
- Arquivos gravados no filesystem em `FILES_PATH` com nome `UUID.ext`. Confirma a convenção do PDF de exemplo.
- Deduplicação por `(user_id, hash)` (migração 006). MIME aceitos: `application/pdf`, `image/png`, `image/jpeg`. Limite de 10MB validado no cliente.
- Endpoints em `internal/handlers/files.go`: `ListMine`, `Upload`, `Serve`, `Update`, `Delete`.
- **Nenhum processamento de PDF hoje**, nem dependência Go ou npm nesse sentido.

**Domínio existente**
- **Não existe entidade Exame.** Um exame é registrado como `Consultation` com `Files` anexados e categorizados por `FileCategory`.
- Vocabulário misto: Go e SQL em `snake_case` inglês, JSON da API em `camelCase`, rótulos de UI em português.
- Nenhuma entidade de resultado, valor medido ou indicador existe hoje.
- Nenhuma biblioteca de gráficos no frontend.
- Envelope de resposta JSON: `{data, error, ok}`, com helpers `writeJSON` / `writeError` em `internal/handlers/helpers.go`.

**Operação e CI**
- Volume único `./data` com `db/` e `uploads/`. `DATABASE_URL` e `SESSION_SECRET` obrigatórias; `FILES_PATH`, `PORT`, `SESSION_SECURE`, `TRUST_PROXY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` opcionais.
- GitHub Actions publica em `ghcr.io/edalcin/medlog` (linux/amd64). Roda lint, typecheck e build do frontend.
- Existem 11 arquivos `_test.go` (handlers e models) que **não rodam no CI**.
- Interface admin já existe: `internal/handlers/admin.go` (11 endpoints) e `frontend/src/routes/Admin.svelte` (9 abas), incluindo backup e restore.

---

## 5. Fatos do PDF de referência

Arquivo de teste: `docs/pdfSangue/f39defb0-78a7-46fd-8d1c-96fea29bf841.pdf` (pasta ignorada pelo git, dados sensíveis, nunca enviar ao remoto).

- 16 páginas, cerca de 40 analitos. O hemograma sozinho traz cerca de 20 sub-analitos.
- Valores derivados e calculados: HOMA-IR, eGFR em três equações com variação por etnia, VLDL por fórmula de Martin/Hopkins, glicemia média estimada, relação PSA livre/total.
- Resultados não numéricos que o modelo precisa tolerar: `>90`, `normais`, `----`, e texto morfológico livre.
- Páginas 15 e 16 formam o **laudo evolutivo**: seis coletas anteriores identificadas por data e número de ficha, cobrindo de 2018 a 2025.
- Marcador `(1)` indica resultado fora da faixa de referência.
- PII presente: nome completo, data de nascimento, número de ficha, médico e CRM, CNES do laboratório, assinaturas digitais.
- Três datas distintas: coleta (08/05/2026), liberação por analito (varia), impressão (04/07/2026). Só a de coleta ordena a série temporal.
- Extratores de texto locais falham nas páginas 2 e 13; o Gemini recebe o PDF nativamente, então isso não bloqueia, mas confirma que depender de parsing local seria frágil.

---

## 6. Próxima ação

Responder **Q4**. Cada decisão fechada deve, na mesma sessão: atualizar `CONTEXT.md` se criar ou alterar um termo, gerar ADR em `docs/adr/` se for difícil de reverter, e atualizar este arquivo. O plano faseado em `docs/v3/` só é escrito quando Q4 a Q7 estiverem fechadas, porque o corte das fases e as colunas da tabela de Observações dependem delas.
