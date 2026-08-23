# Próximos Passos — MedLog V3.0

Documento de continuidade entre sessões. Registra o que já foi decidido, o que está em aberto e os fatos do repositório levantados, para que uma sessão nova retome sem reinvestigar.

**Última atualização:** 2026-08-23
**Fase atual:** fases 1, 2 e 3 concluídas e verificadas. **A prova com a API real do Gemini continua pendente de autorização** do usuário (ADR 0005). Próximo passo: autorizar a chamada real, ou seguir para a fase 4 (visualização).

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
| Q4 | Faixa de referência: texto fiel sempre, `ref_min`/`ref_max` só quando inequívocos, `out_of_range` do marcador do laboratório | `docs/adr/0004-faixa-de-referencia-fiel-com-numericos-opcionais.md` |
| Q5 | PDF enviado sem redação da PII; Consentimento de extração por documento; Extração restrita a `ADMIN`, com registro de autor, modelo e custo | `docs/adr/0005-pii-enviada-sem-redacao-com-consentimento-por-documento.md` |
| Q6 | Extração gravada em `extractions` antes da chamada, executada em goroutine fora de transação, resposta bruta persistida, frontend por polling | `docs/adr/0006-extracao-persistida-antes-da-chamada-executada-em-goroutine.md` |
| Q7 | Relatórios de IA ficam fora da v3.0, adiados para v3.1 com grill próprio | esta tabela (decisão de escopo, reversível, sem ADR) |
| Q8 | Catálogo `health_indicators` global, semeado na migração `007`; chave `code` interno mais `unit` canônica; analito não catalogado gera pendência | `docs/adr/0007-catalogo-semeado-com-codigo-interno-como-chave.md` |
| Q9 | Saída estruturada (`responseSchema`), esquema em Go como fonte única, lista plana, `value_text` sempre e `value_num` opcional, `prompt_version` e `schema_version` na Extração | `docs/adr/0008-saida-estruturada-com-esquema-em-go-e-versoes-gravadas.md` |
| Q10 | Observações nascem em Revisão; `ADMIN` confere contra o PDF e confirma ou rejeita em bloco; só então valem | `docs/adr/0009-observacoes-nascem-em-revisao-confirmadas-em-bloco.md` |
| Q11 | Extrair sempre. Cobertura pelo Laudo evolutivo não bloqueia nem avisa; a colisão continua resolvida por Q3. Decidido com base em custo medido, ver seção 6 | esta tabela (decisão reversível, sem ADR) |
| Q12 | A Extração enriquece `files` com `collected_at`, `lab_name` e `report_number`, e sugere `custom_name` só se vazio; nada sobrescreve campo humano, e só grava na confirmação do bloco | `docs/adr/0010-extracao-enriquece-metadados-do-documento.md` |
| Q13 | `gemini_model` em `app_config`, escolhido na aba admin a partir de lista curta declarada em Go, com o custo por Extração ao lado; padrão `gemini-3.1-flash-lite`. `GEMINI_API_KEY` permanece em variável de ambiente | esta tabela (decisão reversível, sem ADR) |
| Q14 | Quatro fases: 1 esquema, 2 extração sem interface, 3 revisão, 4 visualização. A fase 2 é entregável sozinha, provada por endpoint e inspeção do banco | `docs/v3/plano.md` |

Glossário do domínio em `CONTEXT.md`: Indicador, Observação, Laudo, Data de coleta, Faixa de referência, Procedência, Laudo evolutivo, Extração, Consentimento de extração, Revisão.

---

## 3. Perguntas em aberto

Nenhuma. A fronteira do grill está vazia: Q1 a Q14 fechadas. Perguntas novas surgirão da execução das fases, e de v3.1 (relatórios de IA), que tem grill próprio.

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

**Informado pelo usuário, não levantado do repositório:** a princípio todos os exames de sangue vêm do mesmo laboratório, a Clínica Felippe Mattoso. O layout do laudo é, portanto, estável, o que favorece o mapeamento para o catálogo de Indicadores. Não é garantia contratual: o desenho continua tolerando laudo de outro laboratório, que cai em pendência em vez de dado errado.

- 16 páginas, cerca de 40 analitos. O hemograma sozinho traz cerca de 20 sub-analitos.
- Valores derivados e calculados: HOMA-IR, eGFR em três equações com variação por etnia, VLDL por fórmula de Martin/Hopkins, glicemia média estimada, relação PSA livre/total.
- Resultados não numéricos que o modelo precisa tolerar: `>90`, `normais`, `----`, e texto morfológico livre.
- Páginas 15 e 16 formam o **laudo evolutivo**: seis coletas anteriores identificadas por data e número de ficha, cobrindo de 2018 a 2025. Datas cobertas neste exemplar: 12/06/2025, 03/12/2024, 25/04/2024, 25/01/2024 e 27/03/2023.
- Marcador `(1)` indica resultado fora da faixa de referência.
- PII presente: nome completo, data de nascimento, número de ficha, médico e CRM, CNES do laboratório, assinaturas digitais.
- Extração de texto local: PyMuPDF lê as 16 páginas sem falha, inclusive a 2 e a 13 (verificado na fase 1). Serve para conferir a extração da IA contra o laudo sem gastar tokens. O Gemini continua recebendo o PDF nativamente.

---

## 6. Custo medido da Extração (não recalcular)

Fontes: `https://ai.google.dev/gemini-api/docs/pricing`, `https://ai.google.dev/gemini-api/docs/document-processing` e `https://ai.google.dev/gemini-api/docs/rate-limits`, consultadas em 2026-08-23, com preços vigentes até 31/12/2026.

- O Gemini cobra **258 tokens por página** de PDF, contadas como imagem. O texto nativo do PDF **não é cobrado**.
- O PDF de referência tem 16 páginas, contadas do arquivo: 4.128 tokens. Com prompt, esquema e catálogo de 40 indicadores, o input fica em torno de 6.100 tokens.
- Saída estimada: cerca de 40 Observações `primary` e cerca de 180 `evolutive`, aproximadamente 9.100 tokens de JSON. Tokens de raciocínio são cobrados como saída.
- Custo de uma Extração, tier pago, considerando raciocínio médio: `gemini-3.1-flash-lite` cerca de US$ 0,021; `gemini-3.5-flash-lite` US$ 0,035; `gemini-3.7-flash` US$ 0,054; `gemini-3.5-flash` US$ 0,127; `gemini-3.1-pro-preview` US$ 0,17.
- O Free Tier zera o custo em dólar e o volume pessoal não chega perto dos limites de RPM, TPM e RPD. Mas no Free Tier o conteúdo é usado para melhorar os produtos do Google, o que colide com Q5. Os números por modelo deixaram de ser publicados na documentação e só aparecem no AI Studio.
- `gemini-3.1-pro-preview` não tem Free Tier.

**Consequência já usada em decisão:** o custo é baixo o bastante para não governar desenho. Foi o que fechou Q11 em "extrair sempre". O que governa a escolha do modelo é privacidade, não preço: tier pago, para que o laudo não entre em treino.

---

## 7. Estado da execução

### Fase 1 — Esquema: **concluída**

Migração `007_health_indicators.sql`, em `internal/migrations/`, com `Up` e `Down`:

- `health_indicators`: catálogo global sem `user_id`, `code` UNIQUE, `unit` canônica.
- `extractions`: `status` em (`pending`, `succeeded`, `failed`), `raw_response`, `input_tokens`, `output_tokens`, `prompt_version`, `schema_version`, `triggered_by`, `consented_at`.
- `health_observations`: `value_text` NOT NULL e `value_num` opcional; `reference_text`, `ref_min`, `ref_max`, `out_of_range`; `provenance` em (`primary`, `evolutive`); `status` em (`review`, `confirmed`). Índice de série em `(user_id, indicator_id, collected_at)` e índice único em `(user_id, indicator_id, collected_at, provenance)`, que é o que dá suporte à substituição de `evolutive` por `primary`.
- `files`: colunas novas `collected_at`, `lab_name`, `report_number`, mais índice em `collected_at`.

**Catálogo semeado: 55 Indicadores**, não os cerca de 40 estimados no grill. A diferença vem do hemograma, que rende contagem absoluta e percentual separadas para cada série branca, e da filtração glomerular, que rende cinco Indicadores distintos (CKD-EPI 2009 afrodescendente e não afrodescendente, CKD-EPI 2021, MDRD afrodescendente e não afrodescendente). Nomes e unidades foram lidos do laudo de referência com PyMuPDF, não presumidos.

Correção de fato: **PyMuPDF extrai as 16 páginas sem falha**, inclusive a 2 e a 13, ao contrário do que a seção 4 registrava. Isso não muda nenhuma decisão — o Gemini continua recebendo o PDF nativamente — mas serve para conferir a extração contra o laudo sem custo em tokens.

**Prova executada:** `go test ./internal/db/ -run TestMigrate007`, em `internal/db/migrate_test.go`, verifica que a migração sobe, que o catálogo tem 55 linhas, que `glucose_serum` tem unidade `mg/dL`, que `homa_ir` é adimensional, que as três colunas novas de `files` existem, que `provenance` inválida é rejeitada pelo CHECK, que o `Down` remove tabelas e colunas, e que o `Up` seguinte funciona. `go build ./...`, `go vet ./...` e `go test ./...` passam por inteiro.

### Fase 2 — Extração: **implementada; prova real pendente de autorização**

Arquivos novos: `internal/gemini/gemini.go`, `internal/models/health.go`, `internal/models/appconfig.go`, `internal/handlers/extractions.go`, `internal/handlers/extractions_test.go`. Rotas registradas em `cmd/medlog/main.go`, todas dentro do grupo `RequireAdmin`.

**Decisão de implementação, registrada aqui porque não estava no grill:** usamos `POST /v1beta/models/{model}:generateContent`, não a Interactions API. A documentação de agosto de 2026 marca `generateContent` como legado mas plenamente suportado, e a Interactions API existe para carregar estado de conversa, que esta chamada não tem. Zero dependência nova: `net/http` e `encoding/json` bastam, então `CGO_ENABLED=0` e o tamanho da imagem continuam intactos.

Fatos da API confirmados na documentação oficial: PDF inline em base64 até 50MB, acima disso Files API; `generationConfig.responseMimeType` e `responseSchema` em camelCase, snake_case é ignorado em silêncio; `usageMetadata` traz `promptTokenCount`, `candidatesTokenCount` e `thoughtsTokenCount` em campos separados, e o raciocínio é cobrado como saída, então o código soma `candidates + thoughts`; `gemini-3.1-flash-lite` não usa raciocínio, e na série 3.x não é possível desligá-lo.

Endpoints: `POST /api/extractions` (exige `consent: true`, devolve 202 com a linha `pending`), `GET /api/extractions/{id}`, `GET /api/extractions/{id}/observations`, `GET /api/files/{id}/extractions`, `GET` e `PUT /api/admin/gemini-model`.

Comportamentos que o código garante, cada um coberto por teste: sem consentimento nada é enviado; a linha nasce antes da chamada; a chamada roda em goroutine com `context.Background()`, para que o cliente desistir não cancele o que já está sendo cobrado; a resposta bruta é gravada antes de qualquer interpretação, e também quando a chamada falha; código fora do catálogo é descartado como pendência e nunca cria Indicador; Observação nasce em `review` e não aparece em série; `ExtractionMarkStale` no arranque marca como falha toda extração `pending`, porque goroutine não sobrevive a reinício; modelo fora da lista curada é rejeitado com 400.

**Prova executada:** `go test ./internal/handlers/ -run TestExtraction`, seis testes, todos passando, contra um provedor falso em `httptest` que devolve o envelope real da API. O teste confere o que vai no fio (PDF inline, `responseSchema`, catálogo no prompt) e o que chega no banco, com um fixture que reproduz os casos difíceis do laudo real: `>90` sem `value_num`, TSH com faixa condicional e sem limites numéricos, valor evolutivo datado de 12/06/2025, `out_of_range` true e false vindos do marcador, e um analito fora do catálogo. Mutação de sanidade: desativar a checagem de consentimento faz o teste correspondente falhar com 202 em vez de 400. `go build ./...`, `go vet ./...` e `go test ./...` passam por inteiro.

**Pendente, e é uma decisão do usuário, não técnica:** a prova definida no plano é extrair o PDF de referência com a chave real. Ela envia o laudo, com nome completo e data de nascimento, ao Google, e gasta cerca de US$ 0,02. O ADR 0005 exige consentimento explícito por documento, e esse consentimento é do usuário. `GEMINI_API_KEY` está presente no ambiente, então basta autorizar.

### Fase 3 — Revisão: **concluída**

Backend: `Review`, `Confirm`, `Reject`, `ListIndicators` e `PromoteIndicator` em `internal/handlers/extractions.go`; `FileApplyExtractedMetadata` em `internal/models/file.go`. Frontend: `frontend/src/routes/ExtractionReview.svelte` (novo), rota `/extractions/:id/review` em `App.svelte`, disparo em `Files.svelte` e aba "Extração por IA" em `Admin.svelte`.

O payload de revisão vem numa só chamada e as pendências e sugestões de metadado são **re-derivadas da resposta bruta** com `gemini.ParseRaw`: nada disso precisou de coluna própria. A guarda de não sobrescrever metadado humano fica no SQL (`COALESCE`/`NULLIF`), não no chamador, então nenhum caminho de código a contorna.

**Mudança com efeito em segurança, registrada aqui de propósito:** `internal/middleware/security.go` passou de `X-Frame-Options: DENY` para `SAMEORIGIN`, com `frame-src 'self'`, `object-src 'self'` e `frame-ancestors 'self'` acrescentados ao CSP. Motivo: a revisão mostra o PDF ao lado dos valores, e `DENY` bloqueia até o enquadramento da própria origem. Enquadramento por terceiro continua bloqueado, que é o que `DENY` de fato protegia.

**Defeitos encontrados e corrigidos durante a verificação, não presumidos:**
- N+1 na lista de documentos: a interface fazia uma chamada por PDF da página, até 20, para saber se havia extração. Resolvido com três subconsultas em `fileSelectSQL` (`extraction_count`, `latest_extraction_id`, `latest_extraction_status`, `review_count`), e o código cliente correspondente foi apagado. De 20 requisições para zero.
- O selo de estado continuava "Aguardando revisão" depois de confirmar. Agora reflete a decisão: Confirmada, Rejeitada, Em andamento ou Falhou.

**Fato do ambiente, não defeito nosso:** o PDF no painel lateral não renderizou no Chrome usado na verificação. Os cabeçalhos e os bytes estão corretos, comprovados por `fetch`: 200, `application/pdf`, 207.179 bytes, começando em `%PDF-1.5`, com `X-Frame-Options: SAMEORIGIN`. Navegar direto para o PDF fez o Chrome baixar o arquivo em vez de exibir, o que desanexou a aba. [INFERENCE] O navegador está configurado para baixar PDFs em vez de abri-los. A tela já oferece "Abrir o documento em outra aba" como alternativa.

**Prova executada:** `go test ./internal/handlers/ -run TestReview`, cinco testes, incluindo o que garante que confirmar **não** sobrescreve metadado digitado por humano e ainda preenche o campo vazio, e o que garante que reextrair a mesma coleta **substitui em vez de duplicar** — este último protege a chave única de ADR 0003, que compara data como texto e só vale enquanto todo datetime é gravado num único formato. Verificação visual com a aplicação de verdade rodando: login, lista de documentos mostrando "1 extração / aguardando revisão", diálogo de consentimento com os quatro pontos, tela de revisão com as três regras difíceis honradas (`>90` marcado como não numérico, `faixa não informada` distinta de `dentro da faixa`, linha evolutiva distinta da primária), confirmação em bloco pela interface promovendo 8 Observações e gravando os 4 metadados, e a série de glicose passando a existir de 2024 a 2026. Aba admin verificada nos dois estados, com e sem `GEMINI_API_KEY`, para conferir o aviso de chave ausente. `go build ./...`, `go vet ./...`, `go test ./...` e `npm run build` passam.

### Fase 4 — Visualização: **não iniciada**

Próxima ação conforme `docs/v3/plano.md`: série temporal por Indicador, apenas com Observação `confirmed`, faixa desenhada onde há `ref_min`/`ref_max`, ponto `evolutive` distinto, e Observação sem `value_num` em lista e não em gráfico. Nenhuma biblioteca de gráficos existe no frontend: escolher a menor que resolva, ou desenhar em SVG puro, dado o compromisso com o tamanho da imagem.

Cada decisão nova deve, na mesma sessão: atualizar `CONTEXT.md` se criar ou alterar um termo, gerar ADR em `docs/adr/` se for difícil de reverter, e atualizar este arquivo. Commit sempre em `main`, branch único.
